import type { IAssetMetadata, IAssetToken, IUserAssets } from './assets.ts'
import { sanitizeAssets } from './assets.ts'
import { findTokenBySymbol, toTokenUnits } from './debit-token.ts'
import { hasAddressShape } from '../lib/address.ts'

export function assetMetadata(token: IAssetToken): IAssetMetadata {
  return {
    chainId: token.chainId,
    standard: token.standard,
    address: token.address,
    name: token.name,
    decimals: token.decimals,
    isVerified: token.isVerified,
  }
}

export function sameAssetIdentity(
  token: Pick<IAssetToken, 'chainId' | 'standard' | 'address'>,
  metadata: Pick<IAssetMetadata, 'chainId' | 'standard' | 'address'>,
): boolean {
  return (
    token.chainId === metadata.chainId &&
    token.standard === metadata.standard &&
    normalizedAddress(token.address) === normalizedAddress(metadata.address)
  )
}

/** Legacy symbol lookup is only used to fill metadata omitted by old callers. */
export function resolveAssetMetadata(
  tokens: readonly IAssetToken[],
  symbol: string,
  supplied?: IAssetMetadata | null,
): IAssetMetadata | null {
  if (supplied !== undefined && supplied !== null) {
    assertAssetMetadata(supplied)
    return supplied
  }

  const token = findTokenBySymbol(tokens, symbol)
  return token === null ? null : assetMetadata(token)
}

/** Metadata for a holding the user already has. Invented assets are refused. */
export function requirePortfolioAsset(
  tokens: readonly IAssetToken[],
  symbol: string,
  supplied?: IAssetMetadata | null,
): IAssetMetadata {
  const metadata = resolveAssetMetadata(tokens, symbol, supplied)

  if (metadata === null) {
    throw new AssetSettlementError('Asset was not found in the user portfolio.')
  }

  return assetMetadata(findUniqueHolding(tokens, metadata))
}

/** Pending and success sendings both need a holding that covers the amount. */
export function assertHoldingCoversAmount(
  tokens: readonly IAssetToken[],
  metadata: IAssetMetadata,
  amount: string,
): void {
  const existing = findUniqueHolding(tokens, metadata)
  const units = exactDecimalToUnits(amount, existing.decimals)

  if (units > readBalance(existing.balance)) {
    throw new AssetSettlementError(`Insufficient ${existing.symbol} balance.`)
  }
}

export function exactDecimalToUnits(amount: string, decimals: number): bigint {
  const units = toTokenUnits(amount, decimals)

  if (units === null) {
    throw new AssetSettlementError('Amount does not match the asset decimals.')
  }

  return units
}

/**
 * Applies a signed smallest-unit contribution. Existing entities are retained
 * at zero and positive receiving contributions may append a complete asset.
 */
export function applyAssetContribution(
  assets: IUserAssets,
  symbol: string,
  metadata: IAssetMetadata,
  delta: bigint,
  options: { readonly allowAppend: boolean; readonly now?: Date },
): IUserAssets {
  assertAssetMetadata(metadata)
  const matches = assets.tokens.filter((token) => sameAssetIdentity(token, metadata))

  if (matches.length > 1) {
    throw new AssetSettlementError('User assets contain duplicate entries for the same asset.')
  }

  const existing = matches[0]

  if (existing === undefined) {
    if (delta < 0n || !options.allowAppend) {
      throw new AssetSettlementError('Asset was not found in the user portfolio.')
    }

    return sanitizeAssets({
      quoteCurrency: 'USD',
      updatedAt: (options.now ?? new Date()).toISOString(),
      tokens: [
        ...assets.tokens,
        {
          ...metadata,
          symbol,
          balance: delta.toString(),
        },
      ],
    })
  }

  const balance = readBalance(existing.balance)
  const next = balance + delta

  if (next < 0n) {
    throw new AssetSettlementError('Insufficient asset balance or inconsistent reversal.')
  }

  return sanitizeAssets({
    quoteCurrency: 'USD',
    updatedAt: (options.now ?? new Date()).toISOString(),
    tokens: assets.tokens.map((token) =>
      sameAssetIdentity(token, metadata) ? { ...token, balance: next.toString() } : token,
    ),
  })
}

export class AssetSettlementError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AssetSettlementError'
  }
}

export function assertAssetMetadata(metadata: IAssetMetadata): void {
  if (!/^\d+$/u.test(metadata.chainId)) {
    throw new AssetSettlementError('Asset chain id must be a numeric string.')
  }
  if (
    (metadata.standard === 'native' && metadata.address !== null) ||
    (metadata.standard === 'ERC-20' &&
      (metadata.address === null || !hasAddressShape(metadata.address)))
  ) {
    throw new AssetSettlementError('Asset address does not match its standard.')
  }
  if (
    metadata.name.trim() === '' ||
    metadata.name.length > 128 ||
    !Number.isInteger(metadata.decimals) ||
    metadata.decimals < 0 ||
    metadata.decimals > 36
  ) {
    throw new AssetSettlementError('Asset metadata is invalid.')
  }
}

function findUniqueHolding(
  tokens: readonly IAssetToken[],
  metadata: IAssetMetadata,
): IAssetToken {
  const matches = tokens.filter((token) => sameAssetIdentity(token, metadata))

  if (matches.length > 1) {
    throw new AssetSettlementError('User assets contain duplicate entries for the same asset.')
  }

  const existing = matches[0]

  if (existing === undefined) {
    throw new AssetSettlementError('Asset was not found in the user portfolio.')
  }

  return existing
}

function readBalance(value: string): bigint {
  if (!/^\d+$/u.test(value)) {
    throw new AssetSettlementError('Stored asset balance must be a non-negative integer string.')
  }

  return BigInt(value)
}

function normalizedAddress(value: string | null): string | null {
  return value === null ? null : value.toLowerCase()
}
