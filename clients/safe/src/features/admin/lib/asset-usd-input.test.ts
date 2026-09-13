import { describe, expect, it } from 'vitest'

import {
  convertAssetDraft,
  cryptoEquivalentFromUsdInput,
  cryptoInputFromStoredBalance,
  humanAmountFromMinimalUnits,
  parseAssetDraftToMinimalUnits,
  sumAssetDraftUsd,
  sendingAmountHoldingError,
  tryParseCryptoToMinimalUnits,
  tryParseUsdToMinimalUnits,
  formatStoredUsdAmount,
  usdAmountFromCryptoInput,
  usdEquivalentFromCryptoAmount,
  usdInputFromStoredBalance,
  usdValueFromAssetDraft,
} from './asset-usd-input'

const ETH = {
  chainId: '1',
  standard: 'native' as const,
  address: null,
  symbol: 'ETH',
  name: 'Ether',
  decimals: 18,
  balance: '2000000000000000000',
  isVerified: true,
}

describe('asset-usd-input', () => {
  it('converts stored wei balance to USD input', () => {
    expect(usdInputFromStoredBalance('2000000000000000000', 18, 3284.12)).toBe('6568.24')
  })

  it('converts USD input back to wei', () => {
    expect(tryParseUsdToMinimalUnits('9852.36', 3284.12, 18)).toBe(3000000000000000000n)
  })

  it('formats a human transfer amount from wei', () => {
    expect(humanAmountFromMinimalUnits(3000000000000000000n, 18)).toBe('3')
    expect(humanAmountFromMinimalUnits(1500000n, 6)).toBe('1.5')
    expect(cryptoInputFromStoredBalance('2000000000000000000', 18)).toBe('2')
    expect(tryParseCryptoToMinimalUnits('3', 18)).toBe(3000000000000000000n)
    expect(tryParseCryptoToMinimalUnits('1.5', 6)).toBe(1500000n)
  })

  it('formats a stored USD string for display', () => {
    expect(formatStoredUsdAmount('42347.3')).toBe('$42,347.30')
    expect(formatStoredUsdAmount('502.27')).toBe('$502.27')
    expect(formatStoredUsdAmount('')).toBeNull()
    expect(formatStoredUsdAmount(null)).toBeNull()
  })

  it('shows USD equivalent for a crypto amount', () => {
    expect(usdEquivalentFromCryptoAmount('0.15', 3284.12)).toBe('≈ $492.62')
    expect(usdAmountFromCryptoInput('0.15', 3284.12)).toBe('492.62')
    expect(usdEquivalentFromCryptoAmount('', 3284.12)).toBeNull()
  })

  it('shows crypto equivalent text', () => {
    expect(cryptoEquivalentFromUsdInput('6568.24', ETH, 3284.12)).toBe('≈ 2 ETH')
    expect(cryptoEquivalentFromUsdInput('9852.36', ETH, 3284.12)).toBe('≈ 3 ETH')
  })

  it('converts a draft when switching USD and crypto', () => {
    expect(convertAssetDraft('6568.24', ETH, 'usd', 'crypto', 3284.12)).toBe('2')
    expect(convertAssetDraft('9852.36', ETH, 'usd', 'crypto', 3284.12)).toBe('2')
    expect(convertAssetDraft('3', ETH, 'crypto', 'usd', 3284.12)).toBe('9852.36')
    expect(parseAssetDraftToMinimalUnits('3', ETH, 'crypto', 3284.12)).toBe(3000000000000000000n)
    expect(parseAssetDraftToMinimalUnits('9852.36', ETH, 'usd', 3284.12)).toBe(
      3000000000000000000n,
    )
  })

  it('sums the panel drafts as the estimated total', () => {
    const usdc = {
      chainId: '1',
      standard: 'ERC-20' as const,
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      balance: '0',
      isVerified: true,
    }

    expect(usdValueFromAssetDraft('6568.24', 'usd', 3284.12)).toBe(6568.24)
    expect(usdValueFromAssetDraft('3', 'crypto', 3284.12)).toBe(9852.36)
    expect(usdValueFromAssetDraft('', 'usd', 3284.12)).toBe(0)
    expect(usdValueFromAssetDraft('p.00', 'usd', 3284.12)).toBe(0)
    expect(sumAssetDraftUsd([ETH, usdc], ['6568.24', '1.5'], ['usd', 'usd'], new Map())).toBe(
      6569.74,
    )
    expect(sumAssetDraftUsd([ETH, usdc], ['', '0'], ['usd', 'usd'], new Map())).toBe(0)
  })

  it('refuses a sending amount larger than the holding', () => {
    expect(sendingAmountHoldingError('2', ETH)).toBeNull()
    expect(sendingAmountHoldingError('0.01', ETH)).toBeNull()
    expect(sendingAmountHoldingError('3', ETH)).toBe('Not enough ETH to create this sending.')
    expect(sendingAmountHoldingError('', ETH)).toBeNull()
  })
})
