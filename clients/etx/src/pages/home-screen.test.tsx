import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { type Wei } from '@/core'
import { TEST_MNEMONIC } from '@/core/hdwallet/vectors'
import { AppProviders } from '@/app/providers'
import { AppRouter } from '@/app/router'
import { startHomeScreenInstallListener } from '@/shared/lib/home-screen'
import { createTestAppServices, type ITestAppServices } from '@/test/doubles'

const PASSWORD = 'Korova-7-Luna!'

let services: ITestAppServices

function renderApp() {
  return render(
    <AppProviders services={services}>
      <AppRouter />
    </AppProviders>,
  )
}

beforeEach(async () => {
  services = createTestAppServices()
  services.providerFactory.configure({ balance: 0n as Wei })
  await services.onboarding.importWallet(TEST_MNEMONIC, PASSWORD)
})

describe('Add to Home Screen', () => {
  it('offers a square install control on the sign-in screen', async () => {
    const user = userEvent.setup()

    services = createTestAppServices()
    renderApp()

    const button = await screen.findByRole('button', { name: 'Add to Home Screen' })

    expect(button).toBeInTheDocument()
    expect(button.className).toMatch(/size-11/u)
    await user.click(button)
    expect(screen.getByRole('dialog', { name: 'Add to Home Screen' })).toBeInTheDocument()
  })

  it('opens the browser-menu steps when the system prompt is missing', async () => {
    const user = userEvent.setup()

    renderApp()
    await screen.findByText('Account 1')
    await user.click(screen.getAllByRole('link', { name: 'Settings' })[0]!)

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add to Home Screen' }))

    expect(screen.getByRole('dialog', { name: 'Add to Home Screen' })).toBeInTheDocument()
    expect(screen.getByText(/browser menu/i)).toBeInTheDocument()
    expect(screen.getByText(/Add to Home screen or Install app/i)).toBeInTheDocument()
  })

  it('opens the system prompt when the browser has offered one', async () => {
    const user = userEvent.setup()
    const prompt = vi.fn(async () => undefined)

    startHomeScreenInstallListener()
    const event = new Event('beforeinstallprompt', { cancelable: true })
    Object.assign(event, {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    })
    window.dispatchEvent(event)

    renderApp()
    await screen.findByText('Account 1')
    await user.click(screen.getAllByRole('link', { name: 'Settings' })[0]!)
    await screen.findByRole('heading', { name: 'Settings' })
    await user.click(screen.getByRole('button', { name: 'Add to Home Screen' }))

    expect(prompt).toHaveBeenCalledOnce()
    expect(await screen.findByText(/already has the shortcut/i)).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Add to Home Screen' })).not.toBeInTheDocument()
  })
})
