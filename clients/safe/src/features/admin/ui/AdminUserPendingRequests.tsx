import { Pencil } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { AmountWithUnit } from '@/features/wallet/ui/AmountWithUnit'
import { Alert, AlertDescription, Button, Card, CardContent, CardHeader, CardTitle } from '@/shared/ui'

import { formatAdminListAmount } from '../lib/admin-transfer-display'
import {
  AdminAuthError,
  adminRequestMessage,
  type IAdminActivityRequestPatch,
} from '../model/AdminClient'
import { useAdminSession } from '../model/admin-context'
import { ADMIN_ROLE } from '../model/admin-role'
import {
  ADMIN_PAGE_SIZE,
  type ActivityRequestKind,
  type IAdminDirectoryActivityRequest,
} from '../model/admin-page'
import { directoryUserLabel } from '../model/admin-user-emails'
import { listenForAdminUserRefresh, requestAdminUserRefresh } from '../model/admin-user-refresh'
import { ActivityRequestReviewDialog } from './ActivityRequestReviewDialog'
import { RequestStatusBadge } from './RequestStatusBadge'

const SENT_FOR_APPROVAL = 'Change sent for Super Admin approval.'

/** Pending drafts this regular admin submitted for this user. Super does not see this. */
export function AdminUserPendingRequests({
  userId,
  kind,
}: {
  readonly userId: string
  readonly kind: ActivityRequestKind
}) {
  const { client, lock, role, operatorName } = useAdminSession()
  const [items, setItems] = useState<readonly IAdminDirectoryActivityRequest[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<IAdminDirectoryActivityRequest | null>(null)
  const [isBusy, setBusy] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

  const load = useCallback(() => {
    void client
      .listDirectoryActivityRequests({
        page: 1,
        pageSize: ADMIN_PAGE_SIZE * 5,
        q: '',
        status: 'pending',
        userId,
        ...(operatorName !== null && operatorName.trim() !== ''
          ? { requestedBy: operatorName.trim() }
          : {}),
      })
      .then((page) => {
        setItems(page.items.filter((item) => item.kind === kind))
        setError(null)
      })
      .catch((caught: unknown) => {
        if (caught instanceof AdminAuthError && caught.status === 401) {
          lock()
          return
        }

        setError('Pending requests could not be loaded.')
      })
  }, [client, kind, lock, operatorName, userId])

  useEffect(() => {
    if (role !== ADMIN_ROLE.Admin) {
      return
    }

    load()
  }, [load, role])

  useEffect(() => {
    if (role !== ADMIN_ROLE.Admin) {
      return
    }

    return listenForAdminUserRefresh(userId, load)
  }, [load, role, userId])

  if (role !== ADMIN_ROLE.Admin) {
    return null
  }

  const kindLabel = kind === 'receiving' ? 'receiving' : 'sending'
  const reviewingUserLabel = directoryUserLabel(reviewing?.userEmail, reviewing?.userId ?? null)

  async function saveDraft(id: string, patch: IAdminActivityRequestPatch): Promise<void> {
    if (reviewing === null || reviewing.id !== id) {
      return
    }

    setBusy(true)
    setReviewError(null)

    try {
      const updated = await client.updateActivityRequest(id, patch)
      const next = { ...updated, userEmail: reviewing.userEmail }

      setItems((current) => current.map((item) => (item.id === id ? next : item)))
      setReviewing(null)
      setMessage(SENT_FOR_APPROVAL)
      requestAdminUserRefresh(userId)
    } catch (caught: unknown) {
      if (caught instanceof AdminAuthError && caught.status === 401) {
        lock()
        return
      }

      setReviewError(adminRequestMessage(caught, 'The change could not be sent for approval.'))
    } finally {
      setBusy(false)
    }
  }

  if (error === null && message === null && items.length === 0) {
    return null
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Awaiting Super Admin</CardTitle>
          <p className="text-sm text-muted-foreground">
            Change a pending {kindLabel} request. Super Admin is notified and can approve it.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error === null ? null : (
            <Alert variant="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {message === null ? null : <p className="text-sm text-muted-foreground">{message}</p>}
          {items.length === 0 ? null : (
            <ul className="flex flex-col gap-2">
              {items.map((item) => {
                const userLabel = directoryUserLabel(item.userEmail, item.userId)
                const changeName = `Change ${kindLabel} request from ${item.requestedByName}`

                return (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-xl border px-4 py-3"
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="text-sm font-medium">{item.requestedByName}</span>
                      <AmountWithUnit
                        amount={formatAdminListAmount(item.amount)}
                        unit={item.symbol}
                        className="text-xl font-semibold tracking-tight"
                      />
                      <span className="text-xs text-muted-foreground">User {userLabel}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-2">
                      <RequestStatusBadge status={item.requestStatus} kind={item.kind} />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={changeName}
                        onClick={() => {
                          setReviewError(null)
                          setMessage(null)
                          setReviewing(item)
                        }}
                      >
                        <Pencil />
                        Change
                      </Button>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      <ActivityRequestReviewDialog
        key={reviewing?.id ?? 'closed'}
        mode="revise"
        request={reviewing}
        userLabel={reviewingUserLabel}
        isBusy={isBusy}
        error={reviewing === null ? null : reviewError}
        onClose={() => {
          if (!isBusy) {
            setReviewing(null)
            setReviewError(null)
          }
        }}
        onSave={(id, patch) => {
          void saveDraft(id, patch)
        }}
      />
    </>
  )
}
