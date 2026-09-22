/**
 * Tickers from the `users.assets.tokens` showcase.
 *
 * Same set as the server in `server/src/users/token-symbols.ts`:
 * the cabinet and a transfer record pick from one list.
 */
export const TOKEN_SYMBOL = {
  ETH: 'ETH',
  USDC: 'USDC',
  USDT: 'USDT',
  DAI: 'DAI',
  WBTC: 'WBTC',
  WETH: 'WETH',
  BTC: 'BTC',
} as const

export const TOKEN_SYMBOLS = [
  TOKEN_SYMBOL.ETH,
  TOKEN_SYMBOL.USDC,
  TOKEN_SYMBOL.USDT,
  TOKEN_SYMBOL.DAI,
  TOKEN_SYMBOL.WBTC,
  TOKEN_SYMBOL.WETH,
  TOKEN_SYMBOL.BTC,
] as const

export type TokenSymbol = (typeof TOKEN_SYMBOLS)[number]
