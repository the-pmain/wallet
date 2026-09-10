import { Send } from 'lucide-react'
import { useMemo } from 'react'

import { type PriceMap } from '@/core'
import {
  formatStoredUsdAmount,
  quotePriceUsd,
  usdAmountFromCryptoInput,
} from '@/features/admin/lib/asset-usd-input'
import { addableAssetForTransfer } from '@/features/admin/model/addable-assets'
import { SendingStatusBadge } from '@/features/admin/ui/SendingStatusBadge'
import { shortenAddress } from '@/features/wallet'
import { AmountWithUnit } from '@/features/wallet/ui/AmountWithUnit'
import { TokenAvatar } from '@/features/wallet/ui/TokenAvatar'
import { Alert, AlertDescription, EmptyState, Skeleton } from '@/shared/ui'

import type { IRemoteAssetToken, IRemoteSending } from '../model/RemoteUserDirectory'
import { SENDING_STATUS } from '../model/sending-status'
import { useRemoteAssetQuotes } from '../model/use-remote-asset-quotes'
import { TransferAssetMark } from './TransferDirectionMark'

/**
 * Directory transfer list. View only: rows are not clickable.
 *
 * Row density matches history and the asset showcase: a large amount
 * under the address blew the card open and did not read as a list
 * entry.
 */
export function UserSendingsList({
  sendings,
  isLoading,
  error,
  compact = false,
}: {
  readonly sendings: readonly IRemoteSending[]
  readonly isLoading: boolean
  readonly error: string | null
  readonly compact?: boolean
}) {
  const tokens = useMemo(() => sendingQuoteTokens(sendings), [sendings])
  const { quotes } = useRemoteAssetQuotes(tokens)

  if (error !== null) {
    return (
      <Alert variant="danger">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (isLoading) {
    return <SendingListSkeleton compact={compact} />
  }

  if (sendings.length === 0) {
    if (compact) {
      return <p className="px-4 py-3 text-sm text-muted-foreground sm:px-6">No sendings yet</p>
    }

    return (
      <EmptyState
        icon={Send}
        title="No sendings yet"
        description="Transfers you send from this account appear here. They are only for viewing."
        className="gap-2 py-6"
      />
    )
  }

  return (
    <ul className="divide-y divide-border">
      {sendings.map((sending) => (
        <SendingViewRow key={sending.id} sending={sending} quotes={quotes} />
      ))}
    </ul>
  )
}

function SendingViewRow({
  sending,
  quotes,
}: {
  readonly sending: IRemoteSending
  readonly quotes: PriceMap
}) {
  const asset = addableAssetForTransfer(sending)
  const symbol = sending.symbol ?? asset?.token.symbol ?? '—'
  const name = asset?.token.name ?? sending.symbol ?? 'Unknown asset'
  const recipient = sending.recipientAddress
  const recipientLabel = recipient === null || recipient === '' ? '—' : shortenAddress(recipient)
  const failureMessage = sending.failureMessage?.trim() ?? ''
  const usdLabel = sendingUsdLabel(sending.amount, asset?.token ?? null, quotes)

  return (
    <li className="flex items-start gap-3 px-4 py-3 sm:px-6">
      <TransferAssetMark direction="out">
        <TokenAvatar
          address={asset?.token.address ?? null}
          symbol={symbol}
          chainId={asset?.chainId ?? null}
          className="size-9"
        />
      </TransferAssetMark>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-sm">
          <span className="font-medium">{symbol}</span>
          <span className="truncate font-mono text-xs text-muted-foreground">{recipientLabel}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
          <span className="truncate">
            {name}
            {asset?.chainName === undefined ? null : ` · ${asset.chainName}`}
          </span>
          <SendingTimestamp value={sending.createdAt} />
        </span>
        {sending.status === SENDING_STATUS.Failure && failureMessage !== '' ? (
          <span className="text-xs break-words text-destructive">{failureMessage}</span>
        ) : null}
      </span>

      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <AmountWithUnit
          amount={sending.amount === null || sending.amount === '' ? '—' : sending.amount}
          unit={symbol === '—' ? '' : symbol}
          className="text-sm font-semibold"
        />
        {usdLabel === null ? null : (
          <span className="text-xs text-muted-foreground tabular-nums">{usdLabel}</span>
        )}
        <SendingStatusBadge status={sending.status} />
      </span>
    </li>
  )
}

const SKELETON_COUNT = 3

function SendingListSkeleton({ compact = false }: { readonly compact?: boolean }) {
  const count = compact ? 2 : SKELETON_COUNT

  return (
    <div className="divide-y divide-border" aria-busy aria-live="polite">
      <span className="sr-only">Loading recent activity</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex h-16 items-center gap-3 px-4 sm:px-6" aria-hidden>
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-36" />
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1.5">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </span>
        </div>
      ))}
    </div>
  )
}

function sendingQuoteTokens(sendings: readonly IRemoteSending[]): readonly IRemoteAssetToken[] {
  const tokens: IRemoteAssetToken[] = []
  const seen = new Set<string>()

  for (const sending of sendings) {
    const token = addableAssetForTransfer(sending)?.token

    if (token === undefined) {
      continue
    }

    const key = `${token.chainId}:${token.address ?? 'native'}`

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    tokens.push(token)
  }

  return tokens
}

function sendingUsdLabel(
  amount: string | null,
  token: IRemoteAssetToken | null,
  quotes: PriceMap,
): string | null {
  if (token === null) {
    return null
  }

  return formatStoredUsdAmount(usdAmountFromCryptoInput(amount ?? '', quotePriceUsd(token, quotes)))
}

function SendingTimestamp({ value }: { readonly value: string }) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return <time dateTime={value}>{value}</time>
  }

  return (
    <time dateTime={value} className="shrink-0">
      {date.toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })}
    </time>
  )
}
