import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/utils'

export type TransferDirection = 'in' | 'out'

/** Near-white with a light red or green blush. */
export const TRANSFER_DIRECTION_TINT = {
  out: 'text-[color:color-mix(in_oklch,var(--risk-high)_22%,var(--foreground))]',
  in: 'text-[color:color-mix(in_oklch,var(--risk-low)_22%,var(--foreground))]',
} as const

/**
 * Red outbound / green inbound mark.
 *
 * Color is not the only cue: the arrow points out or in, and the
 * accessible name says Sent or Received.
 */
export function TransferDirectionMark({
  direction,
  className,
}: {
  readonly direction: TransferDirection
  readonly className?: string
}) {
  const outgoing = direction === 'out'

  return (
    <span
      role="img"
      aria-label={outgoing ? 'Sent' : 'Received'}
      className={cn(
        'absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full text-white ring-2 ring-background',
        outgoing ? 'bg-risk-high' : 'bg-risk-low',
        className,
      )}
    >
      {outgoing ? (
        <ArrowUpRight className="size-3" aria-hidden />
      ) : (
        <ArrowDownLeft className="size-3" aria-hidden />
      )}
    </span>
  )
}

/** Token mark with a direction badge in the corner. */
export function TransferAssetMark({
  direction,
  children,
}: {
  readonly direction: TransferDirection
  readonly children: ReactNode
}) {
  return (
    <span className="relative inline-flex shrink-0">
      {children}
      <TransferDirectionMark direction={direction} />
    </span>
  )
}
