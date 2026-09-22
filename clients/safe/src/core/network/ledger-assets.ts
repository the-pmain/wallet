import { toChainId, type ChainId } from '@/core/types'

/**
 * Ledger identity for native Bitcoin.
 *
 * Not an EVM network: it is absent from `BUILT_IN_NETWORKS` so the
 * wallet does not open a JSON-RPC connection for it. The same chain
 * id, ticker, and decimals live on the server in
 * `server/src/users/ledger-assets.ts`.
 *
 * Chain id `20090103` is the GoldRush `btc-mainnet` identifier.
 */
export const BITCOIN_LEDGER_CHAIN_ID: ChainId = toChainId(20090103)

export const BITCOIN_SYMBOL = 'BTC'

export const BITCOIN_NAME = 'Bitcoin'

export const BITCOIN_DECIMALS = 8
