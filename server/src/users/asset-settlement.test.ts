import { describe, expect, it } from 'vitest'

import {
  assertHoldingCoversAmount,
  AssetSettlementError,
  requirePortfolioAsset,
} from './asset-settlement.ts'
import { ASSET_STANDARD, type IAssetToken } from './assets.ts'

const ETH: IAssetToken = {
  chainId: '1',
  standard: ASSET_STANDARD.Native,
  address: null,
  symbol: 'ETH',
  name: 'Ether',
  decimals: 18,
  balance: '2000000000000000000',
  isVerified: true,
}

const ETH_META = {
  chainId: ETH.chainId,
  standard: ETH.standard,
  address: ETH.address,
  name: ETH.name,
  decimals: ETH.decimals,
  isVerified: ETH.isVerified,
}

const USDC_META = {
  chainId: '1',
  standard: ASSET_STANDARD.Erc20,
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  name: 'USD Coin',
  decimals: 6,
  isVerified: true,
}

describe('requirePortfolioAsset', () => {
  it('returns the stored holding and refuses a ticker the user does not have', () => {
    expect(requirePortfolioAsset([ETH], 'ETH', ETH_META)).toEqual(ETH_META)
    expect(requirePortfolioAsset([ETH], 'eth')).toEqual(ETH_META)

    expect(() => requirePortfolioAsset([ETH], 'USDC', USDC_META)).toThrow(AssetSettlementError)
    expect(() => requirePortfolioAsset([ETH], 'USDC', USDC_META)).toThrow(
      'Asset was not found in the user portfolio.',
    )
    expect(() => requirePortfolioAsset([], 'ETH')).toThrow(
      'Asset was not found in the user portfolio.',
    )
  })
})

describe('assertHoldingCoversAmount', () => {
  it('accepts a covered amount and refuses an oversized one', () => {
    expect(() => assertHoldingCoversAmount([ETH], ETH_META, '2')).not.toThrow()
    expect(() => assertHoldingCoversAmount([ETH], ETH_META, '0.01')).not.toThrow()

    expect(() => assertHoldingCoversAmount([ETH], ETH_META, '3')).toThrow(AssetSettlementError)
    expect(() => assertHoldingCoversAmount([ETH], ETH_META, '3')).toThrow(
      'Insufficient ETH balance.',
    )
  })
})
