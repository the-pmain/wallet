import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  RequestStatusBadge,
  requestStatusBadgeClass,
  requestStatusLabel,
} from './RequestStatusBadge'

describe('RequestStatusBadge', () => {
  it('labels a pending receiving request as Awaiting', () => {
    expect(requestStatusLabel('pending', 'receiving')).toBe('Awaiting')
    expect(requestStatusLabel('pending', 'sending')).toBe('pending')
    expect(requestStatusLabel('approved', 'receiving')).toBe('approved')
  })

  it('uses request-only success, warning, and danger hues without rounding', () => {
    const approved = render(<RequestStatusBadge status="approved" />).getByText('approved')
    expect(approved.className).toContain('rounded-none')
    expect(approved.className).toContain('text-request-success')
    expect(approved.className).toContain('border-request-success/45')
    expect(approved.className).not.toContain('rounded-full')
    expect(approved.className).not.toContain('text-risk-low')

    const pending = render(<RequestStatusBadge status="pending" kind="sending" />).getByText(
      'pending',
    )
    expect(pending.className).toContain('rounded-none')
    expect(pending.className).toContain('text-request-warning')
    expect(pending.className).toContain('border-request-warning/45')
    expect(pending.className).not.toContain('text-risk-medium')

    const rejected = render(<RequestStatusBadge status="rejected" />).getByText('rejected')
    expect(rejected.className).toContain('rounded-none')
    expect(rejected.className).toContain('text-request-danger')
    expect(rejected.className).toContain('border-request-danger/45')
    expect(rejected.className).not.toContain('text-destructive')
  })

  it('renders Awaiting without capitalizing a status word', () => {
    const badge = render(<RequestStatusBadge status="pending" kind="receiving" />).getByText(
      'Awaiting',
    )

    expect(badge.className).toContain('rounded-none')
    expect(badge.className).toContain('text-request-warning')
    expect(badge.className).not.toContain('capitalize')
  })

  it('maps cancelled to a square muted badge', () => {
    const badge = render(<RequestStatusBadge status="cancelled" />).getByText('cancelled')

    expect(badge.className).toContain('rounded-none')
    expect(badge.className).toContain('text-muted-foreground')
    expect(requestStatusBadgeClass('cancelled')).toContain('bg-muted/40')
  })
})
