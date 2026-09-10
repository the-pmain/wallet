import { describe, expect, it } from 'vitest'

import {
  CRYPTO_WALLET_KIND,
  cryptoWalletKindLabel,
  identifyCryptoWallet,
  isValidCryptoWalletAddress,
  normalizeCryptoWalletInput,
} from './crypto-wallet'

describe('identifyCryptoWallet', () => {
  it.each([
    ['0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed', CRYPTO_WALLET_KIND.Evm],
    ['0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed', CRYPTO_WALLET_KIND.Evm],
    ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', CRYPTO_WALLET_KIND.Bitcoin],
    ['3FZbgi29cpjq2GjdwV8eyHuJJnkLtktZc5', CRYPTO_WALLET_KIND.Bitcoin],
    ['bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', CRYPTO_WALLET_KIND.Bitcoin],
    ['bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297', CRYPTO_WALLET_KIND.Bitcoin],
    ['tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', CRYPTO_WALLET_KIND.BitcoinTestnet],
    ['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', CRYPTO_WALLET_KIND.Tron],
    ['11111111111111111111111111111111', CRYPTO_WALLET_KIND.Solana],
    ['rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh', CRYPTO_WALLET_KIND.Xrp],
    ['0x1f9840a85d5af5bf1d1762f925bdaddc4201f984000000000000000000000000', CRYPTO_WALLET_KIND.Move],
    ['0:83dfd552e63729b472fcbcc8c45ebcc6691702558b68ec7527e1ba403a0f31a8', CRYPTO_WALLET_KIND.Ton],
  ])('accepts %s as %s', (address, kind) => {
    expect(identifyCryptoWallet(address)).toBe(kind)
    expect(isValidCryptoWalletAddress(address)).toBe(true)
  })

  it('accepts a bitcoin URI by stripping the scheme and query', () => {
    expect(identifyCryptoWallet('bitcoin:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?amount=1.2')).toBe(
      CRYPTO_WALLET_KIND.Bitcoin,
    )
  })

  it('rejects a typo that still looks like an address', () => {
    expect(identifyCryptoWallet('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb')).toBeNull()
    expect(identifyCryptoWallet('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5')).toBeNull()
    expect(identifyCryptoWallet('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD')).toBeNull()
    expect(identifyCryptoWallet('not-a-wallet')).toBeNull()
    expect(identifyCryptoWallet('0x123')).toBeNull()
  })
})

describe('normalizeCryptoWalletInput', () => {
  it('strips a payment URI', () => {
    expect(
      normalizeCryptoWalletInput('  bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4?amount=1 '),
    ).toBe('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')
  })
})

describe('cryptoWalletKindLabel', () => {
  it('names the family for the recipient hint', () => {
    expect(cryptoWalletKindLabel(CRYPTO_WALLET_KIND.Bitcoin)).toBe('Bitcoin')
    expect(cryptoWalletKindLabel(CRYPTO_WALLET_KIND.Move)).toBe('Aptos or Sui')
  })
})
