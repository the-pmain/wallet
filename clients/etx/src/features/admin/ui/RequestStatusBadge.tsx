import type { ActivityRequestKind, ActivityRequestStatus } from '../model/admin-page'
import { Badge } from '@/shared/ui'

interface RequestStatusBadgeProps {
  readonly status: ActivityRequestStatus
  readonly kind?: ActivityRequestKind
}

export function requestStatusLabel(
  status: ActivityRequestStatus,
  kind?: ActivityRequestKind,
): string {
  if (kind === 'receiving' && status === 'pending') {
    return 'Awaiting'
  }

  return status
}

export function RequestStatusBadge({ status, kind }: RequestStatusBadgeProps) {
  const label = requestStatusLabel(status, kind)
  const capitalize = label === status

  if (status === 'approved') {
    return (
      <Badge className={`border-transparent bg-risk-low/15 text-risk-low${capitalize ? ' capitalize' : ''}`}>
        {label}
      </Badge>
    )
  }

  if (status === 'rejected') {
    return (
      <Badge variant="danger" className={capitalize ? 'capitalize' : undefined}>
        {label}
      </Badge>
    )
  }

  if (status === 'pending') {
    return (
      <Badge variant="warning" className={capitalize ? 'capitalize' : undefined}>
        {label}
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className={capitalize ? 'capitalize' : undefined}>
      {label}
    </Badge>
  )
}
