import type { ITokenBalance } from '../model/contracts'

/**
 * Identity of a sendable row.
 *
 * Address alone is not enough: native ETH and native BTC both have
 * no contract, and choosing one would select the other.
 */
export function assetSelectionKey(
  token: Pick<ITokenBalance['token'], 'chainId' | 'address'>,
): string {
  const address = token.address === null ? 'native' : token.address.toLowerCase()

  return `${token.chainId.toString()}:${address}`
}
