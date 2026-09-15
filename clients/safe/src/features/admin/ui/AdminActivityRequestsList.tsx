import { Inbox, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { shortenAddress } from '@/features/wallet'
import { AmountWithUnit } from '@/features/wallet/ui/AmountWithUnit'
import { TokenAvatar } from '@/features/wallet/ui/TokenAvatar'
import { Alert, AlertDescription, Badge, Button, EmptyState, Input, Skeleton } from '@/shared/ui'

import { formatAdminListAmount } from '../lib/admin-transfer-display'
import { formatStoredUsdAmount } from '../lib/asset-usd-input'
import { formatAdminTimestampParts } from '../lib/format-admin-timestamp'
import {
  AdminAuthError,
  adminRequestMessage,
  type IAdminActivityRequestPatch,
} from '../model/AdminClient'
import { addableAssetBySymbol } from '../model/addable-assets'
import { useAdminSession } from '../model/admin-context'
import {
  type IAdminDirectoryActivityRequest,
  type IAdminPage,
  type IAdminPageQuery,
} from '../model/admin-page'
import { directoryUserLabel } from '../model/admin-user-emails'
import { useAdminActivityRequestsLive } from '../model/admin-activity-requests-live'
import { directoryListIsBusy, useAdminDirectoryQuery } from '../model/use-admin-directory-query'
import { ActivityRequestReviewDialog } from './ActivityRequestReviewDialog'
import { AdminDirectoryListPending } from './AdminDirectoryListPending'
import { AdminListPager } from './AdminListPager'
import { RequestStatusBadge } from './RequestStatusBadge'

export function AdminActivityRequestsList({
  userId,
}: {
  readonly userId?: string
} = {}) {
  const { client, canWrite, lock, operatorName } = useAdminSession()
  const { page, pageSize, query, search, setPage, setSearch } = useAdminDirectoryQuery()
  const [listed, setListed] = useState<IAdminPage<IAdminDirectoryActivityRequest> | null>(null)
  const [isFetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<IAdminDirectoryActivityRequest | null>(null)
  const mine = !canWrite
  const scoped = userId !== undefined && userId.trim() !== ''
  const listQuery = directoryRequestQuery(
    page,
    pageSize,
    query,
    mine ? operatorName : null,
    scoped ? userId : undefined,
  )

  useEffect(() => {
    let cancelled = false

    setFetching(true)
    void client
      .listDirectoryActivityRequests(listQuery)
      .then((next) => {
        if (!cancelled) {
          setListed(next)
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

        setError('The requests list could not be loaded.')
      })
      .finally(() => {
        if (!cancelled) {
          setFetching(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    client,
    listQuery.page,
    listQuery.pageSize,
    listQuery.q,
    listQuery.requestedBy,
    listQuery.userId,
    lock,
  ])

  useAdminActivityRequestsLive(() => {
    void client
      .listDirectoryActivityRequests(listQuery)
      .then(setListed)
      .catch((caught: unknown) => {
        if (caught instanceof AdminAuthError && caught.status === 401) {
          lock()
        }
      })
  })

  async function reload(): Promise<void> {
    const next = await client.listDirectoryActivityRequests(listQuery)
    setListed(next)
  }

  async function applyPatched(
    previous: IAdminDirectoryActivityRequest,
    patch: IAdminActivityRequestPatch,
  ): Promise<IAdminDirectoryActivityRequest> {
    const updated = await client.updateActivityRequest(previous.id, patch)
    const next = { ...updated, userEmail: previous.userEmail }

    setReviewing(next)
    setListed((current) => {
      if (current === null) {
        return current
      }

      return {
        ...current,
        items: current.items.map((item) => (item.id === next.id ? next : item)),
      }
    })

    return next
  }

  async function saveDraft(id: string, patch: IAdminActivityRequestPatch): Promise<void> {
    if (reviewing === null || reviewing.id !== id) {
      return
    }

    setBusyId(id)
    setError(null)
    setMessage(null)

    try {
      await applyPatched(reviewing, patch)

      if (mine) {
        setReviewing(null)
        setMessage('Change sent for Super Admin approval.')
      }
    } catch (caught: unknown) {
      if (caught instanceof AdminAuthError && caught.status === 401) {
        lock()

        return
      }

      setError(
        adminRequestMessage(
          caught,
          mine ? 'The change could not be sent for approval.' : 'The request could not be saved.',
        ),
      )
    } finally {
      setBusyId(null)
    }
  }

  async function runReview(
    id: string,
    action: 'approve' | 'reject',
    reviewMessage: string | null = null,
    patch: IAdminActivityRequestPatch | null = null,
  ): Promise<void> {
    setBusyId(id)
    setError(null)

    try {
      if (action === 'approve') {
        if (reviewing !== null && patch !== null) {
          await applyPatched(reviewing, patch)
        }

        await client.approveActivityRequest(id, { reviewMessage })
      } else {
        await client.rejectActivityRequest(id, { reviewMessage })
      }

      setReviewing(null)
      await reload()
    } catch (caught: unknown) {
      if (caught instanceof AdminAuthError && caught.status === 401) {
        lock()

        return
      }

      setError(
        adminRequestMessage(
          caught,
          action === 'approve'
            ? 'The request could not be approved.'
            : 'The request could not be rejected.',
        ),
      )
    } finally {
      setBusyId(null)
    }
  }

  if (error !== null && listed === null) {
    return (
      <Alert variant="danger">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (listed === null) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  const reviewingUserLabel = directoryUserLabel(reviewing?.userEmail, reviewing?.userId ?? null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        {scoped ? (
          <h2 className="text-2xl font-semibold tracking-tight">Requests</h2>
        ) : (
          <h1 className="text-2xl font-semibold tracking-tight">
            {mine ? 'My requests' : 'Requests'}
          </h1>
        )}
        <p className="text-sm text-muted-foreground">
          {requestListSummary(listed.total, mine, scoped)}
        </p>
      </div>
      {error === null || reviewing !== null ? null : (
        <Alert variant="danger">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message === null || reviewing !== null ? null : (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
      <Input
        type="search"
        value={search}
        placeholder={
          mine ? 'Search email, amount, or status' : 'Search operator, email, amount, or status'
        }
        aria-label={
          mine ? 'Search email, amount, or status' : 'Search operator, email, amount, or status'
        }
        onChange={(event) => {
          setSearch(event.target.value)
        }}
      />
      {directoryListIsBusy(search, query, isFetching) ? (
        <AdminDirectoryListPending label="Searching requests" />
      ) : listed.items.length === 0 ? (
        listed.total === 0 && query.trim() === '' ? (
          <EmptyState
            icon={Inbox}
            title={
              scoped
                ? mine
                  ? 'No requests in your name for this user'
                  : 'No requests for this user'
                : mine
                  ? 'No requests in your name'
                  : 'No requests yet'
            }
            description={
              scoped
                ? mine
                  ? 'Sending and receiving drafts you submit for this user appear here.'
                  : 'Admins submit sending and receiving drafts for this user here.'
                : mine
                  ? 'Sending and receiving drafts you submit appear here until Super Admin reviews them.'
                  : 'Admins submit sending and receiving drafts here. Super Admin approves them.'
            }
          />
        ) : (
          <p className="text-sm text-muted-foreground">No requests match this search.</p>
        )
      ) : (
        <ul className="flex flex-col gap-2">
          {listed.items.map((item) => (
            <ActivityRequestRow
              key={item.id}
              item={item}
              action={requestRowAction(canWrite, item.requestStatus)}
              onOpen={() => {
                setError(null)
                setMessage(null)
                setReviewing(item)
              }}
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
      <ActivityRequestReviewDialog
        key={reviewing?.id ?? 'closed'}
        mode={mine ? 'revise' : 'review'}
        request={reviewing}
        userLabel={reviewingUserLabel}
        isBusy={busyId !== null}
        error={reviewing === null ? null : error}
        onClose={() => {
          if (busyId === null) {
            setReviewing(null)
            setError(null)
          }
        }}
        onSave={(id, patch) => {
          void saveDraft(id, patch)
        }}
        onApprove={(id, patch, reviewMessage) => {
          void runReview(id, 'approve', reviewMessage, patch)
        }}
        onReject={(reviewMessage) => {
          if (reviewing !== null) {
            void runReview(reviewing.id, 'reject', reviewMessage)
          }
        }}
      />
    </div>
  )
}

function ActivityRequestRow({
  item,
  action,
  onOpen,
}: {
  readonly item: IAdminDirectoryActivityRequest
  readonly action: 'handle' | 'change' | null
  readonly onOpen: () => void
}) {
  const asset = addableAssetBySymbol(item.symbol)
  const symbol = item.symbol || asset?.token.symbol || '—'
  const name = asset?.token.name ?? item.symbol
  const network = asset?.chainName ?? 'Unknown network'
  const displayAmount = formatAdminListAmount(item.amount)
  const usdLabel = formatStoredUsdAmount(item.usdAmount)
  const recipient =
    item.recipientAddress === null || item.recipientAddress === '' ? null : item.recipientAddress
  const timestamp = formatAdminTimestampParts(item.createdAt)
  const userLabel = directoryUserLabel(item.userEmail, item.userId)
  const kindLabel = item.kind === 'receiving' ? 'Receiving' : 'Sending'
  const actionName =
    action === 'change'
      ? `Change ${item.kind} request from ${item.requestedByName}`
      : `Handle ${item.kind} request from ${item.requestedByName}`

  return (
    <li className="rounded-xl border bg-card px-4 py-3.5">
      <div className="flex items-start gap-3">
        <TokenAvatar
          address={asset?.token.address ?? null}
          symbol={symbol}
          chainId={asset?.chainId ?? null}
          className="size-10"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-sm font-semibold">{item.requestedByName}</p>
                <Badge variant="outline" className="shrink-0">
                  {kindLabel}
                </Badge>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                <Link className="hover:underline" to={`/admin/users/${item.userId}`}>
                  {userLabel}
                </Link>
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {name} · {network}
              </p>
              {recipient === null ? null : (
                <p
                  className="mt-0.5 truncate font-mono text-xs text-muted-foreground"
                  title={recipient}
                >
                  To {shortenAddress(recipient)}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <AmountWithUnit
                amount={displayAmount}
                unit={symbol === '—' ? '' : symbol}
                className="text-2xl font-semibold tracking-tight"
              />
              {usdLabel === null ? null : (
                <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">{usdLabel}</p>
              )}
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
              {timestamp === null ? (
                <time dateTime={item.createdAt}>{item.createdAt}</time>
              ) : (
                <time dateTime={item.createdAt} className="tabular-nums">
                  <span className="font-medium text-foreground">{timestamp.time}</span>
                  <span> · {timestamp.date}</span>
                </time>
              )}
            </p>
            <RequestStatusBadge status={item.requestStatus} kind={item.kind} />
          </div>
        </div>
      </div>
      {action === null ? null : (
        <Button
          type="button"
          className="mt-3 h-12 w-full text-base font-semibold"
          aria-label={actionName}
          onClick={onOpen}
        >
          <Pencil className="size-5" aria-hidden />
          {action === 'change' ? 'Change' : 'Handle'}
        </Button>
      )}
    </li>
  )
}

function requestRowAction(
  canWrite: boolean,
  status: IAdminDirectoryActivityRequest['requestStatus'],
): 'handle' | 'change' | null {
  if (status === 'pending') {
    return canWrite ? 'handle' : 'change'
  }

  if (!canWrite && status === 'approved') {
    return 'change'
  }

  return null
}

function requestListSummary(total: number, mine: boolean, scoped: boolean): string {
  const count = `${String(total)} ${total === 1 ? 'request' : 'requests'}`

  if (scoped && mine) {
    return `${count} for this user in your name. Open Change to edit a request. Super Admin must approve or reject the change.`
  }

  if (scoped) {
    return `${count} for this user. Open Handle to edit, save, approve, or reject a draft.`
  }

  if (mine) {
    return `${count} in your name. Open Change to edit a request. Super Admin must approve or reject the change.`
  }

  return `${count}. Open Handle to edit, save, approve, or reject a draft.`
}

function directoryRequestQuery(
  page: number,
  pageSize: number,
  q: string,
  requestedBy: string | null,
  userId?: string,
): IAdminPageQuery {
  return {
    page,
    pageSize,
    q,
    ...(requestedBy !== null && requestedBy.trim() !== ''
      ? { requestedBy: requestedBy.trim() }
      : {}),
    ...(userId !== undefined && userId.trim() !== '' ? { userId: userId.trim() } : {}),
  }
}
