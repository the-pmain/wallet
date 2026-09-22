import { toChainId, type ChainId } from '@/core/types'

/**
 * Учётная личность нативного Bitcoin.
 *
 * Это не EVM-сеть: её нет в `BUILT_IN_NETWORKS`, поэтому кошелёк не
 * открывает для неё JSON-RPC. Тот же номер сети, тикер и число знаков
 * лежат на сервере в `server/src/users/ledger-assets.ts`.
 *
 * Номер `20090103` — идентификатор GoldRush `btc-mainnet`.
 */
export const BITCOIN_LEDGER_CHAIN_ID: ChainId = toChainId(20090103)

export const BITCOIN_SYMBOL = 'BTC'

export const BITCOIN_NAME = 'Bitcoin'

export const BITCOIN_DECIMALS = 8
