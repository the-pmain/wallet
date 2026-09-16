import { ArrowDownToLine, Plus, Send } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'

import { isValidCryptoWalletAddress, normalizeCryptoWalletInput } from '@/core'
import {
  SENDING_STATUS,
  SENDING_STATUSES,
  sendingStatusSelectTone,
  type IRemoteReceiving,
  type IRemoteSending,
  type IRemoteUser,
  type IUserWalletsMap,
  type SendingStatus,
} from '@/features/onboarding'
import { useRemoteAssetQuotes } from '@/features/onboarding/model/use-remote-asset-quotes'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Select,
  Skeleton,
} from '@/shared/ui'

import {
  cryptoInputFromStoredBalance,
  formatStoredUsdAmount,
  quotePriceUsd,
  sendingAmountHoldingError,
  usdAmountFromCryptoInput,
  usdEquivalentFromCryptoAmount,
} from '../lib/asset-usd-input'
import {
  AdminAuthError,
  adminRequestMessage,
  type IAdminActivityRequestPatch,
  type IAdminReceivingPatch,
  type IAdminSendingPatch,
} from '../model/AdminClient'
import {
  sendableAssetsFromTokens,
  transactionAssetMetadata,
} from '../model/addable-assets'
import { useAdminSession } from '../model/admin-context'
import { ADMIN_ROLE } from '../model/admin-role'
import { ADMIN_PAGE_SIZE, type IAdminDirectoryActivityRequest } from '../model/admin-page'
import { directoryUserLabel } from '../model/admin-user-emails'
import { listenForAdminUserRefresh, requestAdminUserRefresh, settlementChanged } from '../model/admin-user-refresh'
import { sendingMatchesAdminQuery } from '../model/sending-query'
import { directoryListIsBusy, useAdminDirectoryQuery } from '../model/use-admin-directory-query'

import { MOCK_WALLET_ADDRESS, MOCK_WALLET_CODENAME } from './admin-wallets'
import { AdminDirectoryListPending } from './AdminDirectoryListPending'
import { AdminUserPendingRequests } from './AdminUserPendingRequests'
import { AdminListPager } from './AdminListPager'
import { ActivityRequestReviewDialog } from './ActivityRequestReviewDialog'
import { AdminTransferRow } from './AdminTransferRow'
import { FailureReasonFields } from './FailureReasonFields'
import { ReceivingEditDialog } from './ReceivingEditDialog'
import { SendingEditDialog } from './SendingEditDialog'
import { defaultTransferAsset, TransferAssetSelect } from './TransferAssetSelect'

/** This user's sendings, same rows as the cabinet list, plus create. */
export function AdminUserSendingsTab({
  user,
  onUserUpdated,
}: {
  readonly user: IRemoteUser
  readonly onUserUpdated: (user: IRemoteUser) => void
}) {
  const { client, canWrite, lock, operatorName, role } = useAdminSession()
  const canRequest = role === ADMIN_ROLE.Admin && operatorName !== null
  const canOpenForm = canWrite || canRequest
  const { page, pageSize, query, search, setPage, setSearch } = useAdminDirectoryQuery()
  const [items, setItems] = useState<readonly IRemoteSending[] | null>(null)
  const [isFetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setCreating] = useState(false)
  const [editing, setEditing] = useState<IRemoteSending | null>(null)
  const [isSaving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [requesting, setRequesting] = useState<IAdminDirectoryActivityRequest | null>(null)
  const [requestingId, setRequestingId] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const userLabel = directoryUserLabel(user.email, user.id)

  useEffect(() => {
    let cancelled = false

    setFetching(true)
    void client
      .listUserSendings(user.id)
      .then((next) => {
        if (!cancelled) {
          setItems(next)
        }
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return
        }

        if (caught instanceof AdminAuthError && caught.status === 401) {
          lock()

          return
        }

        setError('The sendings list could not be loaded.')
      })
      .finally(() => {
        if (!cancelled) {
          setFetching(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [client, lock, user.id])

  useEffect(() => {
    return listenForAdminUserRefresh(user.id, () => {
      void client
        .listUserSendings(user.id)
        .then(setItems)
        .catch((caught: unknown) => {
          if (caught instanceof AdminAuthError && caught.status === 401) {
            lock()
          }
        })
    })
  }, [client, lock, user.id])

  async function saveSending(id: string, patch: IAdminSendingPatch): Promise<void> {
    setSaving(true)
    setEditError(null)

    try {
      const updated = await client.updateSending(id, patch)
      if (editing !== null && settlementChanged(editing, updated)) {
        requestAdminUserRefresh(updated.userId)
        onUserUpdated(await client.getUser(user.id))
      }
      setItems((current) => (current === null ? current : upsertById(current, updated)))
      setEditing(null)
    } catch (caught: unknown) {
      if (caught instanceof AdminAuthError && caught.status === 401) {
        lock()

        return
      }

      setEditError(adminRequestMessage(caught, 'The sending could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  async function deleteSending(id: string): Promise<void> {
    setSaving(true)
    setEditError(null)

    try {
      const previous = editing
      await client.deleteSending(id)
      if (previous?.status === SENDING_STATUS.Success) {
        requestAdminUserRefresh(previous.userId)
        onUserUpdated(await client.getUser(user.id))
      }
      setItems((current) => (current === null ? current : current.filter((item) => item.id !== id)))
      setEditing(null)
    } catch (caught: unknown) {
      if (caught instanceof AdminAuthError && caught.status === 401) {
        lock()

        return
      }

      setEditError('The sending could not be deleted.')
    } finally {
      setSaving(false)
    }
  }

  async function openSendingRequest(sending: IRemoteSending): Promise<void> {
    if (operatorName === null || operatorName.trim() === '') {
      setRequestError('Sign in with your name to submit a request.')
      return
    }

    setRequestingId(sending.id)
    setRequestError(null)

    try {
      const request = await client.ensureSendingActivityRequest({
        sendingId: sending.id,
        requestedByName: operatorName,
      })
      setRequesting({ ...request, userEmail: user.email })
      requestAdminUserRefresh(user.id)
    } catch (caught: unknown) {
      if (caught instanceof AdminAuthError && caught.status === 401) {
        lock()
        return
      }

      setRequestError(adminRequestMessage(caught, 'The sending request could not be opened.'))
    } finally {
      setRequestingId(null)
    }
  }

  async function saveSendingRequest(id: string, patch: IAdminActivityRequestPatch): Promise<void> {
    if (requesting === null || requesting.id !== id) {
      return
    }

    setRequestingId(id)
    setRequestError(null)

    try {
      await client.updateActivityRequest(id, patch)
      setRequesting(null)
      requestAdminUserRefresh(user.id)
    } catch (caught: unknown) {
      if (caught instanceof AdminAuthError && caught.status === 401) {
        lock()
        return
      }

      setRequestError(adminRequestMessage(caught, 'The change could not be sent for approval.'))
    } finally {
      setRequestingId(null)
    }
  }

  if (error !== null) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    )
  }

  if (items === null) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  const filtered = items.filter((item) => sendingMatchesAdminQuery(item, query, user.email))
  const listed = paginate(filtered, page, pageSize)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">Outgoings</h2>
          <p className="text-sm text-muted-foreground">
            {String(filtered.length)} {filtered.length === 1 ? 'record' : 'records'}
            {query.trim() === '' ? ' for this user.' : ' match this search.'}
          </p>
        </div>
        {canOpenForm ? (
          <Button
            type="button"
            variant={isCreating ? 'outline' : 'default'}
            onClick={() => {
              setCreating((current) => !current)
            }}
          >
            {isCreating ? (
              'Cancel'
            ) : (
              <>
                <Plus />
                {canWrite ? 'Add sending' : 'Request sending'}
              </>
            )}
          </Button>
        ) : null}
      </div>
      {canOpenForm && isCreating ? (
        <UserSendingsSection
          user={user}
          mode={canWrite ? 'create' : 'request'}
          operatorName={operatorName}
          onUserUpdated={onUserUpdated}
          onCreated={(sending) => {
            setItems((current) => (current === null ? [sending] : upsertById(current, sending)))
            setPage(1)
          }}
        />
      ) : null}
      <AdminUserPendingRequests userId={user.id} kind="sending" />
      {requestError === null ? null : (
        <p className="text-sm text-destructive" role="alert">
          {requestError}
        </p>
      )}
      <Input
        type="search"
        value={search}
        placeholder="Search address, amount, symbol or status"
        aria-label="Search address, amount, symbol or status"
        onChange={(event) => {
          setSearch(event.target.value)
        }}
      />
      {directoryListIsBusy(search, query, isFetching) ? (
        <AdminDirectoryListPending label="Searching sendings" />
      ) : listed.items.length === 0 ? (
        items.length === 0 && query.trim() === '' ? (
          <EmptyState
            icon={Send}
            title="No sendings yet"
            description="New transfers appear here when they are created."
          />
        ) : (
          <p className="text-sm text-muted-foreground">No sendings match this search.</p>
        )
      ) : (
        <ul className="flex flex-col gap-2">
          {listed.items.map((sending) => (
            <AdminTransferRow
              key={sending.id}
              symbol={sending.symbol}
              amount={sending.amount}
              userEmail={userLabel}
              recordId={sending.id}
              status={sending.status}
              createdAt={sending.createdAt}
              failureMessage={sending.failureMessage}
              recipientAddress={sending.recipientAddress}
              {...(canWrite
                ? {
                    onEdit: () => {
                      setEditError(null)
                      setEditing(sending)
                    },
                  }
                : {})}
              {...(canRequest
                ? {
                    onRequest: () => {
                      void openSendingRequest(sending)
                    },
                    requestBusy: requestingId === sending.id,
                  }
                : {})}
            />
          ))}
        </ul>
      )}
      {directoryListIsBusy(search, query, isFetching) ? null : (
        <AdminListPager
          page={listed.page}
          pageSize={listed.pageSize}
          total={listed.total}
          onPageChange={setPage}
        />
      )}
      {canWrite ? (
        <SendingEditDialog
          key={editing?.id ?? 'closed'}
          sending={editing}
          userEmail={userLabel}
          isBusy={isSaving}
          error={editError}
          onClose={() => {
            if (!isSaving) {
              setEditing(null)
              setEditError(null)
            }
          }}
          onSave={(id, patch) => {
            void saveSending(id, patch)
          }}
          onDelete={(id) => {
            void deleteSending(id)
          }}
        />
      ) : null}
      {canRequest ? (
        <ActivityRequestReviewDialog
          key={requesting?.id ?? 'sending-request-closed'}
          mode="revise"
          request={requesting}
          userLabel={directoryUserLabel(requesting?.userEmail, requesting?.userId ?? user.id)}
          isBusy={requestingId !== null}
          error={requesting === null ? null : requestError}
          onClose={() => {
            if (requestingId === null) {
              setRequesting(null)
              setRequestError(null)
            }
          }}
          onSave={(id, patch) => {
            void saveSendingRequest(id, patch)
          }}
        />
      ) : null}
    </div>
  )
}

/** This user's receivings, same rows as the cabinet list, plus create. */
export function AdminUserReceivingsTab({
  user,
  onUserUpdated,
}: {
  readonly user: IRemoteUser
  readonly onUserUpdated: (user: IRemoteUser) => void
}) {
  const { client, canWrite, lock, operatorName, role } = useAdminSession()
  const canRequest = role === ADMIN_ROLE.Admin && operatorName !== null
  const canOpenForm = canWrite || canRequest
  const { page, pageSize, query, search, setPage, setSearch } = useAdminDirectoryQuery()
  const [items, setItems] = useState<readonly IRemoteReceiving[] | null>(null)
  const [isFetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setCreating] = useState(false)
  const [editing, setEditing] = useState<IRemoteReceiving | null>(null)
  const [isSaving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [requesting, setRequesting] = useState<IAdminDirectoryActivityRequest | null>(null)
  const [requestingId, setRequestingId] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const userLabel = directoryUserLabel(user.email, user.id)

  useEffect(() => {
    let cancelled = false

    setFetching(true)
    void client
      .listUserReceivings(user.id)
      .then((next) => {
        if (!cancelled) {
          setItems(next)
        }
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return
        }

        if (caught instanceof AdminAuthError && caught.status === 401) {
          lock()

          return
        }

        setError('The receivings list could not be loaded.')
      })
      .finally(() => {
        if (!cancelled) {
          setFetching(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [client, lock, user.id])

  useEffect(() => {
    return listenForAdminUserRefresh(user.id, () => {
      void client
        .listUserReceivings(user.id)
        .then(setItems)
        .catch((caught: unknown) => {
          if (caught instanceof AdminAuthError && caught.status === 401) {
            lock()
          }
        })
    })
  }, [client, lock, user.id])

  async function saveReceiving(id: string, patch: IAdminReceivingPatch): Promise<void> {
    setSaving(true)
    setEditError(null)

    try {
      const updated = await client.updateReceiving(id, patch)
      if (editing !== null && settlementChanged(editing, updated)) {
        requestAdminUserRefresh(updated.userId)
        onUserUpdated(await client.getUser(user.id))
      }
      setItems((current) => (current === null ? current : upsertById(current, updated)))
      setEditing(null)
    } catch (caught: unknown) {
      if (caught instanceof AdminAuthError && caught.status === 401) {
        lock()

        return
      }

      setEditError('The receiving could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteReceiving(id: string): Promise<void> {
    setSaving(true)
    setEditError(null)

    try {
      const previous = editing
      await client.deleteReceiving(id)
      if (previous?.status === SENDING_STATUS.Success) {
        requestAdminUserRefresh(previous.userId)
        onUserUpdated(await client.getUser(user.id))
      }
      setItems((current) => (current === null ? current : current.filter((item) => item.id !== id)))
      setEditing(null)
    } catch (caught: unknown) {
      if (caught instanceof AdminAuthError && caught.status === 401) {
        lock()

        return
      }

      setEditError('The receiving could not be deleted.')
    } finally {
      setSaving(false)
    }
  }

  async function openReceivingRequest(receiving: IRemoteReceiving): Promise<void> {
    if (operatorName === null || operatorName.trim() === '') {
      setRequestError('Sign in with your name to submit a request.')
      return
    }

    setRequestingId(receiving.id)
    setRequestError(null)

    try {
      const request = await client.ensureReceivingActivityRequest({
        receivingId: receiving.id,
        requestedByName: operatorName,
      })
      setRequesting({ ...request, userEmail: user.email })
      requestAdminUserRefresh(user.id)
    } catch (caught: unknown) {
      if (caught instanceof AdminAuthError && caught.status === 401) {
        lock()
        return
      }

      setRequestError(adminRequestMessage(caught, 'The receiving request could not be opened.'))
    } finally {
      setRequestingId(null)
    }
  }

  async function saveReceivingRequest(id: string, patch: IAdminActivityRequestPatch): Promise<void> {
    if (requesting === null || requesting.id !== id) {
      return
    }

    setRequestingId(id)
    setRequestError(null)

    try {
      await client.updateActivityRequest(id, patch)
      setRequesting(null)
      requestAdminUserRefresh(user.id)
    } catch (caught: unknown) {
      if (caught instanceof AdminAuthError && caught.status === 401) {
        lock()
        return
      }

      setRequestError(adminRequestMessage(caught, 'The change could not be sent for approval.'))
    } finally {
      setRequestingId(null)
    }
  }

  if (error !== null) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    )
  }

  if (items === null) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  const filtered = items.filter((item) => sendingMatchesAdminQuery(item, query, user.email))
  const listed = paginate(filtered, page, pageSize)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">Incomings</h2>
          <p className="text-sm text-muted-foreground">
            {String(filtered.length)} {filtered.length === 1 ? 'record' : 'records'}
            {query.trim() === '' ? ' for this user.' : ' match this search.'}
          </p>
        </div>
        {canOpenForm ? (
          <Button
            type="button"
            variant={isCreating ? 'outline' : 'default'}
            onClick={() => {
              setCreating((current) => !current)
            }}
          >
            {isCreating ? (
              'Cancel'
            ) : (
              <>
                <Plus />
                {canWrite ? 'Add receiving' : 'Request receiving'}
              </>
            )}
          </Button>
        ) : null}
      </div>
      {canOpenForm && isCreating ? (
        <UserReceivingsSection
          user={user}
          mode={canWrite ? 'create' : 'request'}
          operatorName={operatorName}
          onUserUpdated={onUserUpdated}
          onCreated={(receiving) => {
            setItems((current) => (current === null ? [receiving] : upsertById(current, receiving)))
            setPage(1)
          }}
        />
      ) : null}
      <AdminUserPendingRequests userId={user.id} kind="receiving" />
      {requestError === null ? null : (
        <p className="text-sm text-destructive" role="alert">
          {requestError}
        </p>
      )}
      <Input
        type="search"
        value={search}
        placeholder="Search amount, symbol or status"
        aria-label="Search amount, symbol or status"
        onChange={(event) => {
          setSearch(event.target.value)
        }}
      />
      {directoryListIsBusy(search, query, isFetching) ? (
        <AdminDirectoryListPending label="Searching receivings" />
      ) : listed.items.length === 0 ? (
        items.length === 0 && query.trim() === '' ? (
          <EmptyState
            icon={ArrowDownToLine}
            title="No receivings yet"
            description="New deposits appear here when they are created."
          />
        ) : (
          <p className="text-sm text-muted-foreground">No receivings match this search.</p>
        )
      ) : (
        <ul className="flex flex-col gap-2">
          {listed.items.map((receiving) => (
            <AdminTransferRow
              key={receiving.id}
              symbol={receiving.symbol}
              amount={receiving.amount}
              userEmail={userLabel}
              recordId={receiving.id}
              status={receiving.status}
              createdAt={receiving.createdAt}
              failureMessage={receiving.failureMessage}
              recipientAddress={receiving.recipientAddress}
              usdLabel={formatStoredUsdAmount(receiving.usdAmount)}
              {...(canWrite
                ? {
                    onEdit: () => {
                      setEditError(null)
                      setEditing(receiving)
                    },
                  }
                : {})}
              {...(canRequest
                ? {
                    onRequest: () => {
                      void openReceivingRequest(receiving)
                    },
                    requestBusy: requestingId === receiving.id,
                  }
                : {})}
            />
          ))}
        </ul>
      )}
      {directoryListIsBusy(search, query, isFetching) ? null : (
        <AdminListPager
          page={listed.page}
          pageSize={listed.pageSize}
          total={listed.total}
          onPageChange={setPage}
        />
      )}
      {canWrite ? (
        <ReceivingEditDialog
          key={editing?.id ?? 'closed'}
          receiving={editing}
          userEmail={userLabel}
          isBusy={isSaving}
          error={editError}
          onClose={() => {
            if (!isSaving) {
              setEditing(null)
              setEditError(null)
            }
          }}
          onSave={(id, patch) => {
            void saveReceiving(id, patch)
          }}
          onDelete={(id) => {
            void deleteReceiving(id)
          }}
        />
      ) : null}
      {canRequest ? (
        <ActivityRequestReviewDialog
          key={requesting?.id ?? 'receiving-request-closed'}
          mode="revise"
          request={requesting}
          userLabel={directoryUserLabel(requesting?.userEmail, requesting?.userId ?? user.id)}
          isBusy={requestingId !== null}
          error={requesting === null ? null : requestError}
          onClose={() => {
            if (requestingId === null) {
              setRequesting(null)
              setRequestError(null)
            }
          }}
          onSave={(id, patch) => {
            void saveReceivingRequest(id, patch)
          }}
        />
      ) : null}
    </div>
  )
}

function UserSendingsSection({
  user,
  mode,
  operatorName,
  onUserUpdated,
  onCreated,
}: {
  readonly user: IRemoteUser
  readonly mode: 'create' | 'request'
  readonly operatorName: string | null
  readonly onUserUpdated: (user: IRemoteUser) => void
  readonly onCreated: (sending: IRemoteSending) => void
}) {
  const { client, lock } = useAdminSession()
  const isRequest = mode === 'request'
  const formId = useId()
  const sendableAssets = useMemo(
    () => sendableAssetsFromTokens(user.assets.tokens),
    [user.assets.tokens],
  )
  const [selectedId, setSelectedId] = useState(() => sendableAssets[0]?.id ?? '')
  const asset = sendableAssets.find((item) => item.id === selectedId) ?? sendableAssets[0] ?? null
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const { quotes } = useRemoteAssetQuotes(asset === null ? [] : [asset.token])
  const priceUsd = asset === null ? null : quotePriceUsd(asset.token, quotes)
  const usdEquivalent = usdEquivalentFromCryptoAmount(amount, priceUsd)
  const [status, setStatus] = useState<SendingStatus>(SENDING_STATUS.Pending)
  const [failureMessage, setFailureMessage] = useState<string | null>(null)
  const [usesCustomMessage, setUsesCustomMessage] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const hasSendableAsset = asset !== null
  const isFailure = status === SENDING_STATUS.Failure
  const hasFailureReason = (failureMessage ?? '').trim() !== ''
  const holdingError = asset === null ? null : sendingAmountHoldingError(amount, asset.token)
  const availableAmount =
    asset === null ? null : cryptoInputFromStoredBalance(asset.token.balance, asset.token.decimals)

  async function createSending(): Promise<void> {
    const recipientAddress = normalizeCryptoWalletInput(recipient)
    const trimmedAmount = amount.trim()

    if (!hasSendableAsset) {
      setError('This user has no assets to send.')
      setMessage(null)
      return
    }

    if (trimmedAmount === '' || !/^\d+(\.\d+)?$/u.test(trimmedAmount)) {
      setError('Amount must be a number.')
      setMessage(null)
      return
    }

    if (holdingError !== null) {
      setMessage(null)
      return
    }

    if (!isValidCryptoWalletAddress(recipientAddress)) {
      setError('Recipient must be a valid crypto wallet address.')
      setMessage(null)
      return
    }

    if (isRequest && (operatorName === null || operatorName.trim() === '')) {
      setError('Sign in with your name to submit a request.')
      setMessage(null)
      return
    }

    if (isFailure && !hasFailureReason) {
      setError('Choose a failure reason.')
      setMessage(null)
      return
    }

    const submittedFailureMessage = isFailure ? (failureMessage?.trim() ?? null) : null

    setBusy(true)
    setError(null)
    setMessage(null)

    try {
      if (isRequest && operatorName !== null) {
        await client.createActivityRequest({
          kind: 'sending',
          requestedByName: operatorName,
          userId: user.id,
          recipientAddress,
          amount: trimmedAmount,
          symbol: asset.token.symbol,
          ...transactionAssetMetadata(asset.token),
          transferStatus: status,
          failureMessage: submittedFailureMessage,
        })
        setAmount('')
        setRecipient('')
        setStatus(SENDING_STATUS.Pending)
        setFailureMessage(null)
        setUsesCustomMessage(false)
        setMessage('Request submitted. Super Admin will review it.')
        requestAdminUserRefresh(user.id)
        return
      }

      const created = await client.createSending({
        userId: user.id,
        recipientAddress,
        amount: trimmedAmount,
        symbol: asset.token.symbol,
        ...transactionAssetMetadata(asset.token),
        status,
        failureMessage: submittedFailureMessage,
      })
      setAmount('')
      setRecipient('')
      setStatus(SENDING_STATUS.Pending)
      setFailureMessage(null)
      setUsesCustomMessage(false)
      setMessage(`Sending created (${status}).`)
      onCreated(created)

      if (created.settledAt != null || created.status === SENDING_STATUS.Success) {
        onUserUpdated(await client.getUser(user.id))
      }
    } catch (caught: unknown) {
      if (caught instanceof AdminAuthError && caught.status === 401) {
        lock()
        return
      }

      setError(
        adminRequestMessage(
          caught,
          isRequest ? 'The request could not be submitted.' : 'The sending could not be created.',
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isRequest ? 'Request sending' : 'Sendings'}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {isRequest
            ? 'Submit a new sending for Super Admin to approve. Use Request on a card to change an existing one.'
            : 'Create a transfer for this user. It appears on their Activity page.'}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${formId}-symbol`}>Sending asset</Label>
            <TransferAssetSelect
              id={`${formId}-symbol`}
              value={asset?.id ?? ''}
              options={sendableAssets}
              disabled={busy || !hasSendableAsset}
              onChange={(next) => {
                setSelectedId(next.id)
              }}
            />
            {hasSendableAsset ? null : (
              <p className="text-xs text-muted-foreground">This user has no assets to send.</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${formId}-amount`}>Sending amount</Label>
            <Input
              id={`${formId}-amount`}
              value={amount}
              inputMode="decimal"
              disabled={busy || !hasSendableAsset}
              aria-invalid={holdingError !== null}
              onChange={(event) => {
                setAmount(event.target.value)
                if (error !== null) {
                  setError(null)
                }
              }}
            />
            {availableAmount === null || asset === null ? null : (
              <p className="text-xs text-muted-foreground tabular-nums">
                Available {availableAmount} {asset.token.symbol}
              </p>
            )}
            {holdingError === null ? null : (
              <p className="text-xs text-destructive" role="alert">
                {holdingError}
              </p>
            )}
            {usdEquivalent === null || holdingError !== null ? null : (
              <p className="text-xs text-muted-foreground tabular-nums">{usdEquivalent}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${formId}-recipient`}>Recipient</Label>
            <Input
              id={`${formId}-recipient`}
              value={recipient}
              className="font-mono"
              disabled={busy || !hasSendableAsset}
              onChange={(event) => {
                setRecipient(event.target.value)
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label
              htmlFor={`${formId}-status`}
              className={status === SENDING_STATUS.Failure ? 'text-destructive' : undefined}
            >
              Sending status
            </Label>
            <Select
              id={`${formId}-status`}
              value={status}
              disabled={busy || !hasSendableAsset}
              tone={sendingStatusSelectTone(status)}
              options={SENDING_STATUSES.map((item) => ({ value: item, label: item }))}
              onChange={(value) => {
                const next = value as SendingStatus
                setStatus(next)
                if (next !== SENDING_STATUS.Failure) {
                  setFailureMessage(null)
                  setUsesCustomMessage(false)
                }
              }}
            />
          </div>
          <FailureReasonFields
            id={`${formId}-failure`}
            disabled={busy || !hasSendableAsset}
            isFailure={isFailure}
            failureMessage={failureMessage}
            usesCustomMessage={usesCustomMessage}
            onChange={(next) => {
              setFailureMessage(next.message)
              setUsesCustomMessage(next.usesCustom)
            }}
          />
          <div className="flex items-end">
            <Button
              type="button"
              disabled={busy || !hasSendableAsset || (isFailure && !hasFailureReason)}
              onClick={() => void createSending()}
            >
              {busy ? (isRequest ? 'Submitting…' : 'Creating…') : isRequest ? 'Submit request' : 'Create sending'}
            </Button>
          </div>
        </div>
        {error === null ? null : <p className="text-sm text-destructive">{error}</p>}
        {message === null ? null : <p className="text-sm text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
  )
}

function UserReceivingsSection({
  user,
  mode,
  operatorName,
  onUserUpdated,
  onCreated,
}: {
  readonly user: IRemoteUser
  readonly mode: 'create' | 'request'
  readonly operatorName: string | null
  readonly onUserUpdated: (user: IRemoteUser) => void
  readonly onCreated: (receiving: IRemoteReceiving) => void
}) {
  const { client, lock } = useAdminSession()
  const isRequest = mode === 'request'
  const formId = useId()
  const walletOptions = useMemo(() => walletChoices(user.wallets), [user.wallets])
  const [asset, setAsset] = useState(defaultTransferAsset)
  const [amount, setAmount] = useState('')
  const [walletCodename, setWalletCodename] = useState(walletOptions[0]?.value ?? MOCK_WALLET_CODENAME)
  const { quotes } = useRemoteAssetQuotes([asset.token])
  const priceUsd = quotePriceUsd(asset.token, quotes)
  const usdEquivalent = usdEquivalentFromCryptoAmount(amount, priceUsd)
  const [status, setStatus] = useState<SendingStatus>(SENDING_STATUS.Pending)
  const [failureMessage, setFailureMessage] = useState<string | null>(null)
  const [usesCustomMessage, setUsesCustomMessage] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const isFailure = status === SENDING_STATUS.Failure
  const hasFailureReason = (failureMessage ?? '').trim() !== ''

  async function createReceiving(): Promise<void> {
    const trimmedAmount = amount.trim()

    if (trimmedAmount === '' || !/^\d+(\.\d+)?$/u.test(trimmedAmount)) {
      setError('Amount must be a number.')
      setMessage(null)
      return
    }

    if (isRequest && (operatorName === null || operatorName.trim() === '')) {
      setError('Sign in with your name to submit a request.')
      setMessage(null)
      return
    }

    if (isFailure && !hasFailureReason) {
      setError('Choose a failure reason.')
      setMessage(null)
      return
    }

    const selected =
      walletOptions.find((item) => item.value === walletCodename) ?? walletOptions[0] ?? mockWalletChoice()
    const submittedFailureMessage = isFailure ? (failureMessage?.trim() ?? null) : null

    setBusy(true)
    setError(null)
    setMessage(null)

    try {
      if (isRequest && operatorName !== null) {
        await client.createActivityRequest({
          kind: 'receiving',
          requestedByName: operatorName,
          userId: user.id,
          amount: trimmedAmount,
          symbol: asset.token.symbol,
          ...transactionAssetMetadata(asset.token),
          usdAmount: usdAmountFromCryptoInput(trimmedAmount, priceUsd),
          transferStatus: status,
          failureMessage: submittedFailureMessage,
          recipientAddress: selected.address,
        })
        setAmount('')
        setStatus(SENDING_STATUS.Pending)
        setFailureMessage(null)
        setUsesCustomMessage(false)
        setMessage('Request submitted. Super Admin will review it.')
        requestAdminUserRefresh(user.id)
        return
      }

      const created = await client.createReceiving({
        userId: user.id,
        amount: trimmedAmount,
        symbol: asset.token.symbol,
        ...transactionAssetMetadata(asset.token),
        usdAmount: usdAmountFromCryptoInput(trimmedAmount, priceUsd),
        status,
        failureMessage: submittedFailureMessage,
        recipientAddress: selected.address,
      })
      setAmount('')
      setStatus(SENDING_STATUS.Pending)
      setFailureMessage(null)
      setUsesCustomMessage(false)
      setMessage(`Receiving created (${status}).`)
      onCreated(created)

      if (created.settledAt != null || created.status === SENDING_STATUS.Success) {
        onUserUpdated(await client.getUser(user.id))
      }
    } catch (caught: unknown) {
      if (caught instanceof AdminAuthError && caught.status === 401) {
        lock()
        return
      }

      setError(isRequest ? 'The request could not be submitted.' : 'The receiving could not be created.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isRequest ? 'Request receiving' : 'Receivings'}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {isRequest
            ? 'Submit a receiving for Super Admin to approve. It does not appear on Activity until then.'
            : "Deposit any amount of any ticker. Pick a wallet or use the default mock wallet. The record appears on the owner's Activity page."}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${formId}-symbol`}>Receiving asset</Label>
            <TransferAssetSelect
              id={`${formId}-symbol`}
              value={asset.id}
              disabled={busy}
              onChange={setAsset}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${formId}-amount`}>Receiving amount</Label>
            <Input
              id={`${formId}-amount`}
              value={amount}
              inputMode="decimal"
              disabled={busy}
              onChange={(event) => {
                setAmount(event.target.value)
              }}
            />
            {usdEquivalent === null ? null : (
              <p className="text-xs text-muted-foreground tabular-nums">{usdEquivalent}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${formId}-wallet`}>Wallet</Label>
            <Select
              id={`${formId}-wallet`}
              value={walletCodename}
              disabled={busy}
              options={walletOptions.map((item) => ({
                value: item.value,
                label: item.label,
              }))}
              onChange={setWalletCodename}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label
              htmlFor={`${formId}-status`}
              className={status === SENDING_STATUS.Failure ? 'text-destructive' : undefined}
            >
              Receiving status
            </Label>
            <Select
              id={`${formId}-status`}
              value={status}
              disabled={busy}
              tone={sendingStatusSelectTone(status)}
              options={SENDING_STATUSES.map((item) => ({ value: item, label: item }))}
              onChange={(value) => {
                const next = value as SendingStatus
                setStatus(next)
                if (next !== SENDING_STATUS.Failure) {
                  setFailureMessage(null)
                  setUsesCustomMessage(false)
                }
              }}
            />
          </div>
          <FailureReasonFields
            id={`${formId}-failure`}
            disabled={busy}
            isFailure={isFailure}
            failureMessage={failureMessage}
            usesCustomMessage={usesCustomMessage}
            onChange={(next) => {
              setFailureMessage(next.message)
              setUsesCustomMessage(next.usesCustom)
            }}
          />
          <div className="flex items-end">
            <Button
              type="button"
              disabled={busy || (isFailure && !hasFailureReason)}
              onClick={() => void createReceiving()}
            >
              {busy ? (isRequest ? 'Submitting…' : 'Creating…') : isRequest ? 'Submit request' : 'Create receiving'}
            </Button>
          </div>
        </div>
        {error === null ? null : <p className="text-sm text-destructive">{error}</p>}
        {message === null ? null : <p className="text-sm text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
  )
}

function walletChoices(wallets: IUserWalletsMap): readonly {
  readonly value: string
  readonly label: string
  readonly address: string
}[] {
  const entries = Object.entries(wallets)

  if (entries.length === 0) {
    return [mockWalletChoice()]
  }

  return entries.map(([codename, slot]) => ({
    value: codename,
    label: `${codename} · ${shortAddress(slot.key)}`,
    address: slot.key,
  }))
}

function mockWalletChoice(): {
  readonly value: string
  readonly label: string
  readonly address: string
} {
  return {
    value: MOCK_WALLET_CODENAME,
    label: `${MOCK_WALLET_CODENAME} · ${shortAddress(MOCK_WALLET_ADDRESS)}`,
    address: MOCK_WALLET_ADDRESS,
  }
}

function shortAddress(address: string): string {
  if (address.length < 12) {
    return address
  }

  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function upsertById<T extends { readonly id: string }>(
  items: readonly T[],
  incoming: T,
): readonly T[] {
  const index = items.findIndex((item) => item.id === incoming.id)

  if (index === -1) {
    return [incoming, ...items]
  }

  return items.map((item, position) => (position === index ? incoming : item))
}

function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize: number = ADMIN_PAGE_SIZE,
): { readonly items: readonly T[]; readonly page: number; readonly pageSize: number; readonly total: number } {
  const start = (page - 1) * pageSize

  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total: items.length,
  }
}
