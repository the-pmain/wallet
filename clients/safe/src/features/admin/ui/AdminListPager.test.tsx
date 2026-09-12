import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AdminListPager } from './AdminListPager'

describe('AdminListPager', () => {
  it('hides when every record fits on one page', () => {
    const { container } = render(
      <AdminListPager page={1} pageSize={20} total={2} onPageChange={() => undefined} />,
    )

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
  })

  it('hides when the list is empty', () => {
    const { container } = render(
      <AdminListPager page={1} pageSize={20} total={0} onPageChange={() => undefined} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('shows only the page number and arrows', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()

    render(<AdminListPager page={2} pageSize={20} total={55} onPageChange={onPageChange} />)

    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
    expect(screen.getByText('2 / 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    await user.click(screen.getByRole('button', { name: 'Next page' }))

    expect(onPageChange.mock.calls).toEqual([[1], [3]])
  })

  it('disables the back arrow on the first page', () => {
    render(<AdminListPager page={1} pageSize={20} total={40} onPageChange={() => undefined} />)

    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()
  })
})
