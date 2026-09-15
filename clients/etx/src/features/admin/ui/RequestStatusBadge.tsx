import type { ActivityRequestKind, ActivityRequestStatus } from '../model/admin-page'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui'

interface RequestStatusBadgeProps {
  readonly status: ActivityRequestStatus
  readonly kind?: ActivityRequestKind
}

/**
 * Статус на карточках activity-request.
 *
 * ПОЧЕМУ СВОЯ ПАЛИТРА. Отправки и получения оставляют общие
 * success / warning / danger таблетки. Заявки берут свои токены
 * бирюза / золото / роза и снимают любое скругление, чтобы статус
 * заявки не путали со статусом перевода.
 *
 * ПОЧЕМУ ТОЛЬКО МЕТКА. Цвет на всей карточке повторяет тот же
 * сигнал и превращает список в стопку предупреждений.
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
