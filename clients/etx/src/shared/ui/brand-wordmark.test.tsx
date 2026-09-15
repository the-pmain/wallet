import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { APP_CONFIG } from '@/shared/config'

import { BrandWordmark } from './brand-wordmark'

describe('BrandWordmark', () => {
  it('sets the product name in the display face', () => {
    render(<BrandWordmark />)

    expect(screen.getByText(APP_CONFIG.brandLabel)).toHaveClass('font-display')
  })
})
