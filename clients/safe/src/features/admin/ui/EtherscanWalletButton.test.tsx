import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EtherscanWalletButton } from './EtherscanWalletButton'

const ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'

describe('EtherscanWalletButton', () => {
  it('links a valid address to Etherscan with the official logo', () => {
    render(<EtherscanWalletButton address={ADDRESS} walletName="cold" />)

    const link = screen.getByRole('link', { name: 'Open cold on Etherscan' })

    expect(link).toHaveAttribute('href', `https://etherscan.io/address/${ADDRESS}`)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link.querySelector('img')?.getAttribute('src')).toBe('/logos/etherscan.svg')
    expect(screen.getByText('Etherscan')).toBeInTheDocument()
  })

  it('disables the button when the address is not a wallet', () => {
    render(<EtherscanWalletButton address="not-an-address" walletName="cold" />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open cold on Etherscan' })).toBeDisabled()
  })
})
