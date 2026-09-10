import { describe, expect, it } from 'vitest'

import {
  CRYPTO_WALLET_KIND,
  identifyCryptoWallet,
  isValidCryptoWalletAddress,
} from './crypto-wallet.ts'

describe('identifyCryptoWallet', () => {
  it('accepts EVM, Bitcoin, Solana, TRON and XRP addresses', () => {
    expect(identifyCryptoWallet('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed')).toBe(
      CRYPTO_WALLET_KIND.Evm,
    )
    expect(identifyCryptoWallet('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(
      CRYPTO_WALLET_KIND.Bitcoin,
    )
    expect(identifyCryptoWallet('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(
      CRYPTO_WALLET_KIND.Bitcoin,
    )
    expect(identifyCryptoWallet('11111111111111111111111111111111')).toBe(CRYPTO_WALLET_KIND.Solana)
    expect(identifyCryptoWallet('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')).toBe(CRYPTO_WALLET_KIND.Tron)
    expect(identifyCryptoWallet('rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh')).toBe(CRYPTO_WALLET_KIND.Xrp)
  })

  it('rejects garbage and checksum typos', () => {
    expect(isValidCryptoWalletAddress('not-a-wallet')).toBe(false)
    expect(isValidCryptoWalletAddress('0x123')).toBe(false)
    expect(isValidCryptoWalletAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb')).toBe(false)
  })
})
