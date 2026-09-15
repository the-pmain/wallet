import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TOKEN_STANDARD, toAddress, toChainId, type IToken, type Timestamp } from '@/core'

import { TokenTrustBadge } from './TokenTrustBadge'

const NOW = 1_785_000_000_000 as Timestamp

const USDT: IToken = {
  chainId: toChainId(1n),
  address: toAddress('0xdAC17F958D2ee523a2206206994597C13D831ec7'),
  standard: TOKEN_STANDARD.Erc20,
  symbol: 'USDT',
  name: 'Tether USD',
  decimals: 6,
  logoUri: null,
  isCustom: false,
  isVerified: true,
  addedAt: NOW,
}

describe('TokenTrustBadge', () => {
  it('красит проверенный контракт цветом успеха', () => {
    render(<TokenTrustBadge token={USDT} />)

    const badge = screen.getByText('verified')

    const chip = badge.closest('[data-slot="badge"]')

    expect(chip?.className).toContain('text-risk-low')
    expect(chip?.className).toContain('bg-risk-low/20')
    expect(badge.className).toContain('text-risk-low')
  })
})
