import { ExternalLink } from 'lucide-react'

import { Button } from '@/shared/ui'

import { etherscanAddressUrl } from './admin-wallets'

const BUTTON_CLASS = 'h-10 w-full gap-2 px-3 text-sm font-medium'

/**
 * Opens the wallet address on Etherscan.
 *
 * Shown to every cabinet role. The official mark sits on a light plate
 * so the navy logo stays readable on the dark admin theme.
 */
export function EtherscanWalletButton({
  address,
  walletName,
}: {
  readonly address: string
  readonly walletName: string
}) {
  const href = etherscanAddressUrl(address)
  const label = `Open ${walletName} on Etherscan`

  if (href === null) {
    return (
      <Button type="button" variant="outline" disabled className={BUTTON_CLASS} aria-label={label}>
        <EtherscanMark />
        Etherscan
        <ExternalLink className="size-3.5 opacity-70" aria-hidden />
      </Button>
    )
  }

  return (
    <Button asChild variant="outline" className={BUTTON_CLASS}>
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
        <EtherscanMark />
        Etherscan
        <ExternalLink className="size-3.5 opacity-70" aria-hidden />
      </a>
    </Button>
  )
}

function EtherscanMark() {
  return (
    <span className="flex size-6 items-center justify-center rounded-md border border-black/10 bg-white">
      <img src="/logos/etherscan.svg" alt="" width={16} height={16} className="size-4" />
    </span>
  )
}
