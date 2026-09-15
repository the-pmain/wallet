import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BrandMark } from './brand-mark'

describe('BrandMark', () => {
  it('uses the purple shield and no white paint', () => {
    render(<BrandMark />)

    const mark = screen.getByRole('img', { name: 'ETWallet' })

    expect(mark).toHaveAttribute('src', '/icons/icon-128.png')
    expect(mark.getAttribute('src')).not.toContain('white')
  })
})
