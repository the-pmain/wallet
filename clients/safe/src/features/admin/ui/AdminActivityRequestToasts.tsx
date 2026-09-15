import { Pencil, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { shortenAddress } from '@/features/wallet'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui'
import { useToastFadeDismiss } from '@/shared/ui/use-toast-fade'

import { formatAdminTimestampParts } from '../lib/format-admin-timestamp'
import { formatStoredUsdAmount } from '../lib/asset-usd-input'
import {
  AdminAuthError,
  adminRequestMessage,
  type IAdminActivityRequestPatch,
} from '../model/AdminClient'
import { useAdminSession } from '../model/admin-context'
import type { ActivityRequestStatus, IAdminDirectoryActivityRequest } from '../model/admin-page'
import { directoryUserLabel } from '../model/admin-user-emails'
import { useAdminRequestQueue } from '../model/admin-request-queue'
import {
  MAX_VISIBLE_REQUEST_TOASTS,
  requestAmountLabel,
  requestToastTitle,
} from '../model/admin-request-toasts'
import { requestAdminUserRefresh } from '../model/admin-user-refresh'
import { ActivityRequestReviewDialog } from './ActivityRequestReviewDialog'
import { RequestStatusBadge } from './RequestStatusBadge'

/**
 * Urgent notice of an activity request.
 *
 * WHY IN THE SHELL, NOT THE REQUESTS TAB. The admin usually sits in
 * users. Waiting for a tab switch means learning about a draft after
 * the operator is already waiting.
 *
 * WHY BOTTOM-RIGHT, NOT TOP. Header and Lock live top-right.
 * This is a work queue, not a tip. The card grows up from the
 * corner; the newest is nearest finger and mouse.
 *
 * WHY IT DOES NOT DISAPPEAR ON ITS OWN. Four seconds is enough to
 * read a status change and not enough to press Handle. The card
 * lives until the request is dismissed.
 *
 * WHY HYDRATE ON ENTRY. The stream reports new frames only.
 * Drafts that appeared while the cabinet was closed would otherwise
 * stay invisible until the next create.
 */
export function AdminActivityRequestToasts() {
  const { client, lock, canWrite } = useAdminSession()
  const { queue, setQueue, dismiss } = useAdminRequestQueue()
  const [reviewing, setReviewing] = useState<IAdminDirectoryActivityRequest | null>(null)
  const [isBusy, setBusy] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

  const visible = queue.slice(0, MAX_VISIBLE_REQUEST_TOASTS)
  const hiddenCount = queue.length - visible.length
  const reviewingUserLabel = directoryUserLabel(reviewing?.userEmail, reviewing?.userId ?? null)

  function mergeQueueItem(next: IAdminDirectoryActivityRequest): void {
    setQueue((current) =>
      current.map((item) =>
        item.id === next.id
          ? {
              ...item,
              ...next,
              userEmail: item.userEmail,
            }
          : item,
      ),
    )
  }

  async function applyPatched(
    previous: IAdminDirectoryActivityRequest,
    patch: IAdminActivityRequestPatch,
  ): Promise<IAdminDirectoryActivityRequest> {
    const updated = await client.updateActivityRequest(previous.id, patch)
    const next = { ...updated, userEmail: previous.userEmail }

    mergeQueueItem(next)
    setReviewing(next)

    return next
  }

  async function saveDraft(id: string, patch: IAdminActivityRequestPatch): Promise<void> {
    if (reviewing === null || reviewing.id !== id) {
      return
    }

    setBusy(true)
    setReviewError(null)

    try {
      await applyPatched(reviewing, patch)
    } catch (caught: unknown) {
      if (caught instanceof AdminAuthError && caught.status === 401) {
        lock()

        return
      }

      setReviewError(adminRequestMessage(caught, 'The request could not be saved.'))
    } finally {
      setBusy(false)
    }
  }

  async function runReview(
    id: string,
    action: 'approve' | 'reject',
    reviewMessage: string | null = null,
    patch: IAdminActivityRequestPatch | null = null,
  ): Promise<void> {
    const previous = reviewing
    setBusy(true)
    setReviewError(null)

    try {
      if (action === 'approve' && previous !== null && patch !== null) {
        await applyPatched(previous, patch)
      }

      const updated =
        action === 'approve'
          ? await client.approveActivityRequest(id, { reviewMessage })
          : await client.rejectActivityRequest(id, { reviewMessage })

      if (action === 'approve' && previous !== null) {
        requestAdminUserRefresh(previous.userId)
      }

      mergeQueueItem({ ...updated, userEmail: previous?.userEmail ?? null })
      setReviewing(null)
    } catch (caught: unknown) {
      if (caught instanceof AdminAuthError && caught.status === 401) {
        lock()

        return
      }

      setReviewError(
        adminRequestMessage(
          caught,
          action === 'approve'
            ? 'The request could not be approved.'
            : 'The request could not be rejected.',
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {visible.length === 0 ? null : (
        <div
          className="pointer-events-none fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-50 ml-auto flex w-full max-w-md flex-col-reverse gap-2 sm:left-auto sm:w-[min(calc(100%-2rem),24rem)]"
          aria-live="assertive"
          aria-relevant="additions"
        >
          {visible.map((request) => (
            <ActivityRequestCard
              key={request.id}
              request={request}
              canHandle={canWrite && request.requestStatus === 'pending'}
              onHandle={() => {
                setReviewError(null)
                setReviewing(request)
              }}
              onDismiss={() => {
                dismiss(request.id, request.requestStatus)

                if (reviewing?.id === request.id && !isBusy) {
                  setReviewing(null)
                  setReviewError(null)
                }
              }}
            />
          ))}
          {hiddenCount > 0 ? (
            <Link
              to="/admin/requests"
              className="pointer-events-auto flex min-h-12 items-center justify-center rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-raised"
            >
              {hiddenCount === 1 ? '1 more request' : `${String(hiddenCount)} more requests`}
            </Link>
          ) : null}
        </div>
      )}
      <ActivityRequestReviewDialog
        key={reviewing?.id ?? 'closed'}
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
        onApprove={(id, patch, reviewMessage) => {
          void runReview(id, 'approve', reviewMessage, patch)
        }}
        onReject={(reviewMessage) => {
          if (reviewing !== null) {
            void runReview(reviewing.id, 'reject', reviewMessage)
          }
        }}
      />
    </>
  )
}

function ActivityRequestCard({
  request,
  canHandle,
  onHandle,
  onDismiss,
}: {
  readonly request: IAdminDirectoryActivityRequest
  readonly canHandle: boolean
  readonly onHandle: () => void
  readonly onDismiss: () => void
}) {
  const amount = requestAmountLabel(request)
  const usdLabel = formatStoredUsdAmount(request.usdAmount)
  const recipient = request.recipientAddress
  const timestamp = formatAdminTimestampParts(request.createdAt)
  const title = requestToastTitle(request)
  const handleName = amount === null ? `Handle ${title}` : `Handle ${title} ${amount}`
  const tone = requestCardTone(request.requestStatus)
  const { isLeaving, dismiss } = useToastFadeDismiss(onDismiss)

  return (
    <article
      role="alert"
      className={cn(
        'flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-raised backdrop-blur-md duration-200 motion-reduce:animate-none',
        isLeaving
          ? 'pointer-events-none animate-out fade-out'
          : 'pointer-events-auto animate-in fade-in slide-in-from-bottom-2',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-1.5 size-2.5 shrink-0 rounded-full ring-4',
            tone.dot,
            request.requestStatus === 'pending' && 'motion-safe:animate-pulse',
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold tracking-tight">{title}</p>
            <RequestStatusBadge status={request.requestStatus} kind={request.kind} />
          </div>
          {amount === null ? null : (
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{amount}</p>
          )}
          {usdLabel === null ? null : (
            <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">{usdLabel}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {request.requestedByName} · User {directoryUserLabel(request.userEmail, request.userId)}
            {recipient === null || recipient === '' ? null : ` · ${shortenAddress(recipient)}`}
          </p>
          {request.reviewMessage === null || request.reviewMessage === '' ? null : (
            <p className="mt-1 text-sm text-muted-foreground">{request.reviewMessage}</p>
          )}
          {timestamp === null ? null : (
            <p className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <time
                dateTime={request.createdAt}
                className="text-xl font-semibold tracking-tight text-foreground/75 tabular-nums"
              >
                {timestamp.time}
              </time>
              <span className="text-sm text-muted-foreground">{timestamp.date}</span>
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label={`Dismiss ${title}`}
          className="tap-target focus-ring -mt-1 -mr-1 cursor-pointer rounded-md p-2 text-muted-foreground transition-[color,opacity] duration-150 hover:text-foreground hover:opacity-70"
          onClick={dismiss}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {canHandle ? (
        <Button
          type="button"
          className="h-16 min-h-16 w-full text-lg font-semibold"
          aria-label={handleName}
          onClick={onHandle}
        >
          <Pencil className="size-6" aria-hidden />
          Handle
        </Button>
      ) : null}
    </article>
  )
}

function requestCardTone(status: ActivityRequestStatus): { readonly dot: string } {
  if (status === 'approved') {
    return { dot: 'bg-request-success ring-request-success/25' }
  }

  if (status === 'rejected') {
    return { dot: 'bg-request-danger ring-request-danger/25' }
  }

  if (status === 'cancelled') {
    return { dot: 'bg-muted-foreground ring-muted-foreground/20' }
  }

  return { dot: 'bg-request-warning ring-request-warning/25' }
}
