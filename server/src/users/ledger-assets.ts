/**
 * Ledger identity for native Bitcoin.
 *
 * This is not an EVM network. The wallet must not attach an RPC URL
 * or offer it in the network switcher. Balances and transfers are
 * settled from `users.assets`, in satoshis.
 *
 * Chain id `20090103` is the GoldRush `btc-mainnet` identifier.
 */
export const BITCOIN_LEDGER_CHAIN_ID = '20090103'

export const BITCOIN_SYMBOL = 'BTC'

export const BITCOIN_NAME = 'Bitcoin'

export const BITCOIN_DECIMALS = 8

export function isBitcoinSymbol(symbol: string): boolean {
  return symbol.trim().toUpperCase() === BITCOIN_SYMBOL
}
