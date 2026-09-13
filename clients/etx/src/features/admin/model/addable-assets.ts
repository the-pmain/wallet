import { BUILT_IN_CHAIN_ID, BUILT_IN_NETWORKS, listVerifiedTokens, toChainId, type ChainId } from '@/core'
import type {
  IRemoteAssetToken,
  IRemoteSending,
  ITransactionAssetMetadata,
} from '@/features/onboarding/model/RemoteUserDirectory'

/**
 * Криптовалюта, которую кабинет может дописать в витрину `assets`.
 *
 * Источник — встроенные сети и проверенные контракты. Произвольный
 * адрес сюда не попадает: знак в списке выдаётся только по этой паре
 * «сеть и адрес», и чужой контракт с тем же тикером знака не получит.
 */
export interface IAddableAsset {
  readonly id: string
  readonly chainId: ChainId
  readonly chainName: string
  readonly token: IRemoteAssetToken
}

/** Ключ позиции: сеть и адрес, без учёта регистра адреса. */
export function remoteAssetKey(token: Pick<IRemoteAssetToken, 'chainId' | 'address'>): string {
  return `${token.chainId}:${token.address === null ? 'native' : token.address.toLowerCase()}`
}

/** Имя сети для подписи строки. Неизвестная сеть — номер, не выдумка. */
export function networkNameForChain(chainId: string): string {
  const match = BUILT_IN_NETWORKS.find((network) => network.chainId.toString() === chainId)

  return match === undefined ? `Chain ${chainId}` : match.name
}

/** Идентификатор сети для знака. Битая строка — `null`, список не падает. */
export function parseRemoteChainId(chainId: string): ChainId | null {
  try {
    return toChainId(chainId)
  } catch {
    return null
  }
}

function nativeAsset(network: (typeof BUILT_IN_NETWORKS)[number]): IAddableAsset {
  return {
    id: remoteAssetKey({ chainId: network.chainId.toString(), address: null }),
    chainId: network.chainId,
    chainName: network.name,
    token: {
      chainId: network.chainId.toString(),
      standard: 'native',
      address: null,
      symbol: network.nativeCurrency.symbol,
      name: network.nativeCurrency.name,
      decimals: network.nativeCurrency.decimals,
      balance: '0',
      isVerified: true,
    },
  }
}

function verifiedAsset(
  network: (typeof BUILT_IN_NETWORKS)[number],
  token: ReturnType<typeof listVerifiedTokens>[number],
): IAddableAsset {
  return {
    id: remoteAssetKey({ chainId: token.chainId.toString(), address: token.address }),
    chainId: token.chainId,
    chainName: network.name,
    token: {
      chainId: token.chainId.toString(),
      standard: 'ERC-20',
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      balance: '0',
      isVerified: true,
    },
  }
}

function buildAddableAssets(): readonly IAddableAsset[] {
  const items: IAddableAsset[] = []

  for (const network of BUILT_IN_NETWORKS) {
    items.push(nativeAsset(network))

    for (const token of listVerifiedTokens(network.chainId)) {
      items.push(verifiedAsset(network, token))
    }
  }

  return items
}

/**
 * Список криптовалют в меню добавления.
 *
 * Порядок как у сетей: сначала нативная валюта, затем проверенные
 * контракты этой сети. Повторных ключей нет — это свойство сборки,
 * а не фильтра при открытии меню.
 */
export const ADDABLE_ASSETS: readonly IAddableAsset[] = buildAddableAssets()

/**
 * Строка витрины по тикеру из `sendings.symbol`.
 *
 * Один тикер бывает в нескольких сетях. Для кабинета берём Ethereum,
 * затем первую найденную — иначе знака не будет вовсе.
 */
export function addableAssetBySymbol(symbol: string | null): IAddableAsset | null {
  if (symbol === null) {
    return null
  }

  const needle = symbol.trim().toUpperCase()

  if (needle === '') {
    return null
  }

  const matches = ADDABLE_ASSETS.filter((item) => item.token.symbol.toUpperCase() === needle)

  return matches.find((item) => item.chainId === BUILT_IN_CHAIN_ID.Ethereum) ?? matches[0] ?? null
}

/** Exact asset for a transfer, with Ethereum-first ticker fallback for legacy rows. */
export function addableAssetForTransfer(
  transfer: Pick<IRemoteSending, 'assetChainId' | 'assetAddress' | 'symbol'>,
): IAddableAsset | null {
  if (typeof transfer.assetChainId === 'string') {
    const exactKey = remoteAssetKey({
      chainId: transfer.assetChainId,
      address: transfer.assetAddress ?? null,
    })
    const exact = ADDABLE_ASSETS.find((item) => item.id === exactKey)

    if (exact !== undefined) {
      return exact
    }
  }

  return addableAssetBySymbol(transfer.symbol)
}

export function transactionAssetMetadata(token: IRemoteAssetToken): ITransactionAssetMetadata {
  return {
    assetChainId: token.chainId,
    assetStandard: token.standard,
    assetAddress: token.address,
    assetName: token.name,
    assetDecimals: token.decimals,
    assetIsVerified: token.isVerified,
  }
}

/** Holdings the cabinet may send: balance must already be greater than zero. */
export function sendableAssetsFromTokens(
  tokens: readonly IRemoteAssetToken[],
): readonly IAddableAsset[] {
  const items: IAddableAsset[] = []

  for (const token of tokens) {
    let balance: bigint
    try {
      balance = BigInt(token.balance)
    } catch {
      continue
    }

    if (balance <= 0n) {
      continue
    }

    const catalog = ADDABLE_ASSETS.find((item) => item.id === remoteAssetKey(token))
    const chainId = catalog?.chainId ?? parseRemoteChainId(token.chainId)

    if (chainId === null) {
      continue
    }

    items.push({
      id: remoteAssetKey(token),
      chainId,
      chainName: catalog?.chainName ?? networkNameForChain(token.chainId),
      token,
    })
  }

  return items
}
