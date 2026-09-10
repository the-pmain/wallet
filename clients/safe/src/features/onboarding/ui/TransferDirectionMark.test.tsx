import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TransferDirectionMark } from './TransferDirectionMark'

describe('TransferDirectionMark', () => {
  it('names an outbound transfer as sent', () => {
    render(
      <span className="relative">
        <TransferDirectionMark direction="out" />
      </span>,
    )

    expect(screen.getByRole('img', { name: 'Sent' })).toBeInTheDocument()
  })

  it('names an inbound transfer as received', () => {
    render(
      <span className="relative">
        <TransferDirectionMark direction="in" />
      </span>,
    )

    expect(screen.getByRole('img', { name: 'Received' })).toBeInTheDocument()
  })
})
