import { useMemo } from 'react'

import { BITCOIN_LEDGER_CHAIN_ID, type ChainId } from '@/core'
import { useDisplayedAssets } from '@/features/onboarding'

import type { ITokenBalance } from './contracts'
import { useWalletSnapshot } from './wallet-context'

interface ISendAssets {
  /** Assets on the active chain, plus ledger BTC when the portfolio is remote. */
  readonly assets: readonly ITokenBalance[]
  readonly isLoading: boolean
  readonly isRemote: boolean

  /** Transfer chain: the wallet's active network or the selected asset's. */
  readonly chainId: ChainId | null
}

/**
 * Asset list for the send screen.
 *
 * Same source as the home screen and Assets: for a directory record,
 * `users.assets` from the server; otherwise the local session snapshot.
 * A directory portfolio also keeps ledger BTC, which has no EVM network
 * to switch to. A local wallet stays on the active chain.
 */
export function useSendAssets(): ISendAssets {
  const snapshot = useWalletSnapshot()
  const displayed = useDisplayedAssets({
    tokens: snapshot.tokenBalances,
    portfolio: snapshot.portfolio,
    isLoading: snapshot.isTokensLoading,
  })

  const activeChainId = snapshot.activeNetwork?.chainId ?? null

  const assets = useMemo((): readonly ITokenBalance[] => {
    const tokens = displayed.tokens

    if (activeChainId === null) {
      return tokens
    }

    return tokens.filter(
      (item) =>
        item.token.chainId === activeChainId ||
        (displayed.isRemote && item.token.chainId === BITCOIN_LEDGER_CHAIN_ID),
    )
  }, [activeChainId, displayed.isRemote, displayed.tokens])

  const chainId = activeChainId ?? assets[0]?.token.chainId ?? null

  return {
    assets,
    isLoading: displayed.isLoading,
    isRemote: displayed.isRemote,
    chainId,
  }
}
