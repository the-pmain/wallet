import { useMemo } from 'react'

import { BITCOIN_LEDGER_CHAIN_ID, type ChainId } from '@/core'
import { useDisplayedAssets } from '@/features/onboarding'

import type { ITokenBalance } from './contracts'
import { useWalletSnapshot } from './wallet-context'

interface ISendAssets {
  /** Активы активной сети и учётный BTC, если портфель пришёл с сервера. */
  readonly assets: readonly ITokenBalance[]
  readonly isLoading: boolean
  readonly isRemote: boolean

  /** Сеть перевода: активная сеть кошелька или сеть выбранного актива. */
  readonly chainId: ChainId | null
}

/**
 * Список активов для экрана отправки.
 *
 * Берёт тот же источник, что главный экран и раздел Assets: для записи
 * справочника — `users.assets` с сервера, иначе — снимок локальной сессии.
 * У записи справочника в списке остаётся учётный BTC: у него нет
 * EVM-сети, на которую можно переключиться. Локальный кошелёк
 * остаётся на активной сети.
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
