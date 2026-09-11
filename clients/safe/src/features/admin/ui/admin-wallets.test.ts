import { describe, expect, it } from 'vitest'

import { etherscanAddressUrl, MOCK_WALLET_ADDRESS } from './admin-wallets'

describe('etherscanAddressUrl', () => {
  it('builds an Etherscan account URL for a wallet address', () => {
    expect(etherscanAddressUrl(' 0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed ')).toBe(
      'https://etherscan.io/address/0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    )
    expect(etherscanAddressUrl(MOCK_WALLET_ADDRESS)).toBe(
      `https://etherscan.io/address/${MOCK_WALLET_ADDRESS}`,
    )
  })

  it('rejects values that are not a 20-byte hex address', () => {
    expect(etherscanAddressUrl('')).toBeNull()
    expect(etherscanAddressUrl('not-an-address')).toBeNull()
    expect(etherscanAddressUrl('0x1234')).toBeNull()
    expect(etherscanAddressUrl('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed0')).toBeNull()
  })
})
