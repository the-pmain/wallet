import { ArrowDownToLine, Plus, Send } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'

import { isValidCryptoWalletAddress, normalizeCryptoWalletInput } from '@/core'
import {
  SENDING_SSE_TYPE,
  SENDING_STATUS,
  SENDING_STATUSES,
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
  formatStoredUsdAmount,
  quotePriceUsd,
  usdAmountFromCryptoInput,
  usdEquivalentFromCryptoAmount,
} from '../lib/asset-usd-input'
import { AdminAuthError, type IAdminReceivingPatch, type IAdminSendingPatch } from '../model/AdminClient'
import { transactionAssetMetadata } from '../model/addable-assets'
import { useAdminSession } from '../model/admin-context'
import { ADMIN_PAGE_SIZE } from '../model/admin-page'
import { useAdminSendingsLive } from '../model/admin-sendings-live'
import { directoryUserLabel } from '../model/admin-user-emails'
import { listenForAdminUserRefresh, requestAdminUserRefresh, settlementChanged } from '../model/admin-user-refresh'
import { sendingMatchesAdminQuery } from '../model/sending-query'
import { directoryListIsBusy, useAdminDirectoryQuery } from '../model/use-admin-directory-query'

import { MOCK_WALLET_ADDRESS, MOCK_WALLET_CODENAME } from './admin-wallets'
import { AdminDirectoryListPending } from './AdminDirectoryListPending'
import { AdminListPager } from './AdminListPager'
import { AdminTransferRow } from './AdminTransferRow'
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
  const { client, canWrite, lock } = useAdminSession()
  const { page, pageSize, query, search, setPage, setSearch } = useAdminDirectoryQuery()
  const [items, setItems] = useState<readonly IRemoteSending[] | null>(null)
  const [isFetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setCreating] = useState(false)
  const [editing, setEditing] = useState<IRemoteSending | null>(null)
  const [isSaving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
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

  useAdminSendingsLive((event) => {
    if (event.userId !== user.id) {
      return
    }

    if (event.type_send === SENDING_SSE_TYPE.Delete) {
      setItems((current) =>
        current === null ? current : current.filter((item) => item.id !== event.id),
      )

      return
    }

    setItems((current) => (current === null ? current : upsertById(current, event)))
  })

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

      setEditError('The sending could not be saved.')
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
          <h2 className="text-2xl font-semibold tracking-tight">Sendings</h2>
          <p className="text-sm text-muted-foreground">
            {String(filtered.length)} {filtered.length === 1 ? 'record' : 'records'}
            {query.trim() === '' ? ' for this user.' : ' match this search.'}
          </p>
        </div>
        {canWrite ? (
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
                Add sending
              </>
            )}
          </Button>
        ) : null}
      </div>
      {canWrite && isCreating ? (
        <UserSendingsSection
          user={user}
          onUserUpdated={onUserUpdated}
          onCreated={(sending) => {
            setItems((current) => (current === null ? [sending] : upsertById(current, sending)))
            setPage(1)
          }}
        />
      ) : null}
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
  const { client, canWrite, lock } = useAdminSession()
  const { page, pageSize, query, search, setPage, setSearch } = useAdminDirectoryQuery()
  const [items, setItems] = useState<readonly IRemoteReceiving[] | null>(null)
  const [isFetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setCreating] = useState(false)
  const [editing, setEditing] = useState<IRemoteReceiving | null>(null)
  const [isSaving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
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
          <h2 className="text-2xl font-semibold tracking-tight">Receivings</h2>
          <p className="text-sm text-muted-foreground">
            {String(filtered.length)} {filtered.length === 1 ? 'record' : 'records'}
            {query.trim() === '' ? ' for this user.' : ' match this search.'}
          </p>
        </div>
        {canWrite ? (
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
                Add receiving
              </>
            )}
          </Button>
        ) : null}
      </div>
      {canWrite && isCreating ? (
        <UserReceivingsSection
          user={user}
          onUserUpdated={onUserUpdated}
          onCreated={(receiving) => {
            setItems((current) => (current === null ? [receiving] : upsertById(current, receiving)))
            setPage(1)
          }}
        />
      ) : null}
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
    </div>
  )
}

function UserSendingsSection({
  user,
  onUserUpdated,
  onCreated,
}: {
  readonly user: IRemoteUser
  readonly onUserUpdated: (user: IRemoteUser) => void
  readonly onCreated: (sending: IRemoteSending) => void
}) {
  const { client, lock } = useAdminSession()
  const formId = useId()
  const [asset, setAsset] = useState(defaultTransferAsset)
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const { quotes } = useRemoteAssetQuotes([asset.token])
  const priceUsd = quotePriceUsd(asset.token, quotes)
  const usdEquivalent = usdEquivalentFromCryptoAmount(amount, priceUsd)
  const [status, setStatus] = useState<SendingStatus>(SENDING_STATUS.Pending)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function createSending(): Promise<void> {
    const recipientAddress = normalizeCryptoWalletInput(recipient)
    const trimmedAmount = amount.trim()

    if (!isValidCryptoWalletAddress(recipientAddress)) {
      setError('Recipient must be a valid crypto wallet address.')
      setMessage(null)
      return
    }

    if (trimmedAmount === '' || !/^\d+(\.\d+)?$/u.test(trimmedAmount)) {
      setError('Amount must be a number.')
      setMessage(null)
      return
    }

    setBusy(true)
    setError(null)
    setMessage(null)

    try {
      const created = await client.createSending({
        userId: user.id,
        recipientAddress,
        amount: trimmedAmount,
        symbol: asset.token.symbol,
        ...transactionAssetMetadata(asset.token),
        status,
        failureMessage: status === SENDING_STATUS.Failure ? 'Rejected by admin' : null,
      })
      setAmount('')
      setRecipient('')
      setStatus(SENDING_STATUS.Pending)
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

      setError('The sending could not be created.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sendings</CardTitle>
        <p className="text-sm text-muted-foreground">
          Create a transfer for this user. It appears on their Activity page.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${formId}-symbol`}>Sending asset</Label>
            <TransferAssetSelect
              id={`${formId}-symbol`}
              value={asset.id}
              disabled={busy}
              onChange={setAsset}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${formId}-amount`}>Sending amount</Label>
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
            <Label htmlFor={`${formId}-recipient`}>Recipient</Label>
            <Input
              id={`${formId}-recipient`}
              value={recipient}
              className="font-mono"
              disabled={busy}
              onChange={(event) => {
                setRecipient(event.target.value)
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${formId}-status`}>Sending status</Label>
            <Select
              id={`${formId}-status`}
              value={status}
              disabled={busy}
              options={SENDING_STATUSES.map((item) => ({ value: item, label: item }))}
              onChange={(value) => {
                setStatus(value as SendingStatus)
              }}
            />
          </div>
          <div className="flex items-end">
            <Button type="button" disabled={busy} onClick={() => void createSending()}>
              {busy ? 'Creating…' : 'Create sending'}
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
  onUserUpdated,
  onCreated,
}: {
  readonly user: IRemoteUser
  readonly onUserUpdated: (user: IRemoteUser) => void
  readonly onCreated: (receiving: IRemoteReceiving) => void
}) {
  const { client, lock } = useAdminSession()
  const formId = useId()
  const walletOptions = useMemo(() => walletChoices(user.wallets), [user.wallets])
  const [asset, setAsset] = useState(defaultTransferAsset)
  const [amount, setAmount] = useState('')
  const [walletCodename, setWalletCodename] = useState(walletOptions[0]?.value ?? MOCK_WALLET_CODENAME)
  const { quotes } = useRemoteAssetQuotes([asset.token])
  const priceUsd = quotePriceUsd(asset.token, quotes)
  const usdEquivalent = usdEquivalentFromCryptoAmount(amount, priceUsd)
  const [status, setStatus] = useState<SendingStatus>(SENDING_STATUS.Pending)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function createReceiving(): Promise<void> {
    const trimmedAmount = amount.trim()

    if (trimmedAmount === '' || !/^\d+(\.\d+)?$/u.test(trimmedAmount)) {
      setError('Amount must be a number.')
      setMessage(null)
      return
    }

    const selected =
      walletOptions.find((item) => item.value === walletCodename) ?? walletOptions[0] ?? mockWalletChoice()

    setBusy(true)
    setError(null)
    setMessage(null)

    try {
      const created = await client.createReceiving({
        userId: user.id,
        amount: trimmedAmount,
        symbol: asset.token.symbol,
        ...transactionAssetMetadata(asset.token),
        usdAmount: usdAmountFromCryptoInput(trimmedAmount, priceUsd),
        status,
        failureMessage: status === SENDING_STATUS.Failure ? 'Rejected by admin' : null,
        recipientAddress: selected.address,
      })
      setAmount('')
      setStatus(SENDING_STATUS.Pending)
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

      setError('The receiving could not be created.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receivings</CardTitle>
        <p className="text-sm text-muted-foreground">
          Deposit any amount of any ticker. Pick a wallet or use the default mock wallet. The
          record appears on the owner&apos;s Activity page.
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
            <Label htmlFor={`${formId}-status`}>Receiving status</Label>
            <Select
              id={`${formId}-status`}
              value={status}
              disabled={busy}
              options={SENDING_STATUSES.map((item) => ({ value: item, label: item }))}
              onChange={(value) => {
                setStatus(value as SendingStatus)
              }}
            />
          </div>
          <div className="flex items-end">
            <Button type="button" disabled={busy} onClick={() => void createReceiving()}>
              {busy ? 'Creating…' : 'Create receiving'}
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
