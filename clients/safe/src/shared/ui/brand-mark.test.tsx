import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BrandMark } from './brand-mark'

describe('BrandMark', () => {
  it('shows the black cube on light and the white cube on dark', () => {
    const { container } = render(<BrandMark />)
    const images = container.querySelectorAll('img')

    expect(screen.getByRole('img', { name: 'ELM' })).toBeInTheDocument()
    expect(images).toHaveLength(2)
    expect(images[0]).toHaveAttribute('src', '/icons/icon-128.png')
    expect(images[1]).toHaveAttribute('src', '/icons/icon-white-128.png')
    expect(images[0]).toHaveClass('dark:hidden')
    expect(images[1]).toHaveClass('hidden', 'dark:block')
  })

  it('stays silent when a visible name already sits beside it', () => {
    render(<BrandMark alt="" />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
