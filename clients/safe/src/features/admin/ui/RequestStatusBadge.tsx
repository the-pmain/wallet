import type { ActivityRequestKind, ActivityRequestStatus } from '../model/admin-page'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui'

interface RequestStatusBadgeProps {
  readonly status: ActivityRequestStatus
  readonly kind?: ActivityRequestKind
}

/**
 * Request status on activity-request cards.
 *
 * WHY A PRIVATE PALETTE. Sending and receiving keep the shared
 * success / warning / danger pills. Request badges use their own
 * teal / gold / rose tokens and drop every rounding so a request
 * status is not mistaken for a transfer status.
 *
 * WHY ONLY THE BADGE. Colour on the whole card repeats the same
 * signal and makes the list look like a stack of alerts.
 */
const REQUEST_BADGE_SHAPE = 'rounded-none'

export function requestStatusLabel(
  status: ActivityRequestStatus,
  kind?: ActivityRequestKind,
): string {
  if (kind === 'receiving' && status === 'pending') {
    return 'Awaiting'
  }

  return status
}

export function requestStatusBadgeClass(status: ActivityRequestStatus): string {
  if (status === 'approved') {
    return 'border-request-success/45 bg-request-success/10 text-request-success'
  }

  if (status === 'rejected') {
    return 'border-request-danger/45 bg-request-danger/10 text-request-danger'
  }

  if (status === 'pending') {
    return 'border-request-warning/45 bg-request-warning/10 text-request-warning'
  }

  return 'border-border bg-muted/40 text-muted-foreground'
}

export function RequestStatusBadge({ status, kind }: RequestStatusBadgeProps) {
  const label = requestStatusLabel(status, kind)
  const capitalize = label === status

  return (
    <Badge
      variant="outline"
      className={cn(
        REQUEST_BADGE_SHAPE,
        requestStatusBadgeClass(status),
        capitalize && 'capitalize',
      )}
    >
      {label}
    </Badge>
  )
}
