import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { AppProviders } from '@/app/providers'
import { AppRouter } from '@/app/router'
import { createTestAppServices, type ITestAppServices } from '@/test/doubles'

let services: ITestAppServices

function renderApp() {
  return render(
    <AppProviders services={services}>
      <AppRouter />
    </AppProviders>,
  )
}

beforeEach(() => {
  window.localStorage.removeItem('etwallet.logo-study-ratings-shield')
  services = createTestAppServices()
})

describe('Щит в пяти материалах', () => {
  it('открывает градиент, кристалл и стекло для ETX и Safe', async () => {
    window.history.replaceState(null, '', '/logo-variants')
    renderApp()

    expect(await screen.findByRole('heading', { name: 'Rate the logo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ETX · Gradient' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ETX · Crystal' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ETX · Glass' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ETX · Gloss' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ETX · Metal' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Safe · Gradient' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Safe · Crystal' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Safe · Glass' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Safe · Gloss' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Safe · Metal' })).toBeInTheDocument()
  })

  it('запоминает оценку', async () => {
    const user = userEvent.setup()

    window.history.replaceState(null, '', '/logo-variants')
    renderApp()

    await screen.findByRole('heading', { name: 'Rate the logo' })
    await user.click(screen.getByRole('button', { name: 'ETX · Glass, 4' }))

    expect(screen.getByRole('button', { name: 'ETX · Glass, 4' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(window.localStorage.getItem('etwallet.logo-study-ratings-shield')).toContain(
      '"etx-glass":4',
    )
  })
})
