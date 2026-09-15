import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BrandMark } from './brand-mark'

describe('BrandMark', () => {
  it('uses the dark metal tile and no white paint', () => {
    render(<BrandMark />)

    const mark = screen.getByRole('img', { name: 'ELM' })

    expect(mark).toHaveAttribute('src', '/icons/icon-128.png')
    expect(mark.getAttribute('src')).not.toContain('white')
  })

  it('stays silent when a visible name already sits beside it', () => {
    render(<BrandMark alt="" />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
