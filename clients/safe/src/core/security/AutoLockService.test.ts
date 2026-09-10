import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeClock } from '@/test/doubles'

import { AutoLockService } from './AutoLockService'

const TIMEOUT_MS = 60_000

let clock: FakeClock
let service: AutoLockService

beforeEach(() => {
  clock = new FakeClock(1_700_000_000_000)
  service = new AutoLockService({ clock }, { timeoutMs: TIMEOUT_MS })
})

describe('AutoLockService: countdown', () => {
  it('remaining time is unknown before start', () => {
    /* "Not started" and "zero left" are different states, and the
       latter means lock now. */
    expect(service.remainingMs).toBeNull()
    expect(service.isRunning).toBe(false)
  })

  it('after start remaining time equals the full timeout', () => {
    service.start()

    expect(service.remainingMs).toBe(TIMEOUT_MS)
  })

  it('remaining time decreases with time', () => {
    service.start()
    clock.advance(20_000)

    expect(service.remainingMs).toBe(TIMEOUT_MS - 20_000)
  })

  it('stop clears the countdown', () => {
    service.start()
    service.stop()

    expect(service.remainingMs).toBeNull()
    expect(service.isRunning).toBe(false)
  })

  it('a second start does not create a second timer', () => {
    const expired = vi.fn()

    service.on('autolock:expired', expired)
    service.start()
    service.start()

    clock.advance(TIMEOUT_MS + 1000)

    expect(expired).toHaveBeenCalledTimes(1)
  })
})

describe('AutoLockService: timeout expiry', () => {
  it('reports expiry when the timeout is reached', () => {
    const expired = vi.fn()

    service.on('autolock:expired', expired)
    service.start()

    clock.advance(TIMEOUT_MS + 1000)

    expect(expired).toHaveBeenCalledTimes(1)
  })

  it('does not report before the timeout', () => {
    const expired = vi.fn()

    service.on('autolock:expired', expired)
    service.start()

    clock.advance(TIMEOUT_MS - 5000)

    expect(expired).not.toHaveBeenCalled()
  })

  it('stops the countdown before calling the handler', () => {
    /* The handler locks the wallet; a timer that outlived the lock
       would call destroyed services. */
    let runningInsideHandler: boolean | null = null

    service.on('autolock:expired', () => {
      runningInsideHandler = service.isRunning
    })
    service.start()

    clock.advance(TIMEOUT_MS + 1000)

    expect(runningInsideHandler).toBe(false)
  })

  it('activity postpones the lock', () => {
    const expired = vi.fn()

    service.on('autolock:expired', expired)
    service.start()

    clock.advance(TIMEOUT_MS - 5000)
    service.notifyActivity()
    clock.advance(TIMEOUT_MS - 5000)

    expect(expired).not.toHaveBeenCalled()
  })

  it('activity after stop starts nothing', () => {
    const expired = vi.fn()

    service.on('autolock:expired', expired)
    service.start()
    service.stop()
    service.notifyActivity()

    clock.advance(TIMEOUT_MS + 1000)

    expect(expired).not.toHaveBeenCalled()
  })
})

describe('AutoLockService: changing the timeout', () => {
  it('a new timeout is applied from the start of the countdown', () => {
    /* Applying a new timeout to time already elapsed would lock the
       wallet immediately when a shorter value is chosen. */
    service.start()
    clock.advance(50_000)

    service.setTimeout(30_000)

    expect(service.remainingMs).toBe(30_000)
  })

  it('changing the timeout on a stopped service does not start the countdown', () => {
    service.setTimeout(30_000)

    expect(service.isRunning).toBe(false)
  })
})
