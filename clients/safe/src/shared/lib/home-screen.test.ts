import { describe, expect, it, vi } from 'vitest'

import {
  getDeferredInstallPrompt,
  isHomeScreenInstalled,
  isIosDevice,
  isStandaloneDisplay,
  promptHomeScreenInstall,
  resetHomeScreenInstall,
  startHomeScreenInstallListener,
} from './home-screen'

describe('isIosDevice', () => {
  it('recognises an iPhone', () => {
    expect(
      isIosDevice({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        platform: 'iPhone',
        maxTouchPoints: 5,
      }),
    ).toBe(true)
  })

  it('recognises an iPad that reports itself as a Mac', () => {
    expect(
      isIosDevice({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      }),
    ).toBe(true)
  })

  it('does not treat a desktop Mac as iOS', () => {
    expect(
      isIosDevice({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        platform: 'MacIntel',
        maxTouchPoints: 0,
      }),
    ).toBe(false)
  })
})

describe('isStandaloneDisplay', () => {
  it('is true when the display-mode query matches', () => {
    expect(
      isStandaloneDisplay({
        matchMedia: (query: string) =>
          ({
            matches: query.includes('display-mode: standalone'),
            media: query,
          }) as MediaQueryList,
        navigator,
      }),
    ).toBe(true)
  })

  it('is false in an ordinary browser tab', () => {
    expect(isStandaloneDisplay()).toBe(false)
  })
})

describe('install prompt capture', () => {
  it('holds the event so a later button click can open it', async () => {
    startHomeScreenInstallListener()

    const prompt = vi.fn(async () => undefined)
    const event = new Event('beforeinstallprompt', { cancelable: true })
    Object.assign(event, {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    })

    window.dispatchEvent(event)

    expect(getDeferredInstallPrompt()).not.toBeNull()
    await expect(promptHomeScreenInstall()).resolves.toBe('accepted')
    expect(prompt).toHaveBeenCalledOnce()
    expect(getDeferredInstallPrompt()).toBeNull()
    expect(isHomeScreenInstalled()).toBe(true)
  })

  it('returns unavailable when the browser never offered a prompt', async () => {
    resetHomeScreenInstall()

    await expect(promptHomeScreenInstall()).resolves.toBe('unavailable')
  })
})
