import type { ITokenBalance } from '../model/contracts'

/**
 * Личность строки отправки.
 *
 * Одного адреса мало: у нативных ETH и BTC нет контракта, и выбор
 * одного выбирал бы другой.
 */
export function assetSelectionKey(
  token: Pick<ITokenBalance['token'], 'chainId' | 'address'>,
): string {
  const address = token.address === null ? 'native' : token.address.toLowerCase()

  return `${token.chainId.toString()}:${address}`
}
