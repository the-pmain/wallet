import type { IAdminDirectoryActivityRequest } from './admin-page'
import {
  ACTIVITY_REQUEST_SSE_TYPE,
  requestFromSseEvent,
  type ActivityRequestSseType,
  type IActivityRequestSseEvent,
} from './activity-request-sse'

/** How many cards show at once. The rest collapse to a list link. */
export const MAX_VISIBLE_REQUEST_TOASTS = 3

export interface IRequestToastItem extends IAdminDirectoryActivityRequest {
  readonly liveType?: ActivityRequestSseType
}

export function operatorNamesMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = left?.trim().toLowerCase() ?? ''
  const b = right?.trim().toLowerCase() ?? ''

  return a !== '' && a === b
}

/** Regular admin only sees Super's approve/reject of their own draft. */
export function isOperatorDecisionToast(
  request: Pick<IAdminDirectoryActivityRequest, 'requestedByName' | 'requestStatus'>,
  operatorName: string | null,
): boolean {
  return (
    (request.requestStatus === 'approved' || request.requestStatus === 'rejected') &&
    operatorNamesMatch(request.requestedByName, operatorName)
  )
}

export function dismissedRequestKey(
  id: string,
  requestStatus: IAdminDirectoryActivityRequest['requestStatus'],
): string {
  return `${id}:${requestStatus}`
}

/**
 * Live toast queue for activity requests.
 *
 * Create always inserts. A pending update resurfaces so Super Admin
 * can approve the changed draft. A dismissed snapshot stays gone
 * until the status changes, except a later pending update.
 */
export function applyLiveRequestEvent(
  current: readonly IRequestToastItem[],
  event: IActivityRequestSseEvent,
  dismissed: ReadonlySet<string> = new Set(),
): readonly IRequestToastItem[] {
  const request: IRequestToastItem = {
    ...requestFromSseEvent(event),
    liveType: event.type_request,
  }
  const isPendingUpdate =
    event.type_request === ACTIVITY_REQUEST_SSE_TYPE.Update && request.requestStatus === 'pending'
  const key = dismissedRequestKey(request.id, request.requestStatus)

  if (!isPendingUpdate && dismissed.has(key)) {
    return current.filter((item) => item.id !== request.id)
  }

  return uniqueRequests([request, ...current.filter((item) => item.id !== request.id)])
}

/**
 * Merges the directory pending page with toasts already on screen.
 *
 * Live frames can arrive before `GET` returns. Rows the list does not
 * know yet stay. Listed rows that are no longer pending drop out of
 * the hydrate set but remain if a later live status is showing.
 */
export function hydrateRequestQueue(
  current: readonly IRequestToastItem[],
  listed: readonly IAdminDirectoryActivityRequest[],
  dismissed: ReadonlySet<string> = new Set(),
): readonly IRequestToastItem[] {
  const listedById = new Map(listed.map((item) => [item.id, item]))
  const liveOnly = current.filter((item) => !listedById.has(item.id))
  const pendingListed = listed.filter(
    (item) =>
      item.requestStatus === 'pending' &&
      !dismissed.has(dismissedRequestKey(item.id, item.requestStatus)),
  )

  return uniqueRequests([...liveOnly, ...pendingListed])
}

export function requestAmountLabel(request: IAdminDirectoryActivityRequest): string | null {
  const amount = request.amount.trim()
  const symbol = request.symbol.trim()

  if (amount === '' && symbol === '') {
    return null
  }

  if (amount === '') {
    return symbol
  }

  if (symbol === '') {
    return amount
  }

  return `${amount} ${symbol}`
}

export function requestToastTitle(request: IRequestToastItem): string {
  const kind = request.kind === 'receiving' ? 'receiving' : 'sending'

  if (request.requestStatus === 'pending') {
    return request.liveType === ACTIVITY_REQUEST_SSE_TYPE.Update
      ? `Updated ${kind} request`
      : kind === 'receiving'
        ? 'Awaiting receiving request'
        : `Pending ${kind} request`
  }

  if (request.requestStatus === 'approved') {
    return `${kind === 'receiving' ? 'Receiving' : 'Sending'} request approved`
  }

  if (request.requestStatus === 'rejected') {
    return `${kind === 'receiving' ? 'Receiving' : 'Sending'} request rejected`
  }

  return `${kind === 'receiving' ? 'Receiving' : 'Sending'} request cancelled`
}

function uniqueRequests(requests: readonly IRequestToastItem[]): readonly IRequestToastItem[] {
  const byId = new Map<string, IRequestToastItem>()

  for (const item of requests) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item)
    }
  }

  return [...byId.values()].sort(compareNewestFirst)
}

function compareNewestFirst(left: IRequestToastItem, right: IRequestToastItem): number {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt < right.createdAt ? 1 : -1
  }

  return left.id < right.id ? 1 : -1
}
