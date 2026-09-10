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

describe('AutoLockService: отсчёт', () => {
  it('до запуска остаток неизвестен', () => {
    /* «Не запущено» и «осталось ноль» — разные состояния, и второе
       означает немедленную блокировку. */
    expect(service.remainingMs).toBeNull()
    expect(service.isRunning).toBe(false)
  })

  it('после запуска остаток равен полному сроку', () => {
    service.start()

    expect(service.remainingMs).toBe(TIMEOUT_MS)
  })

  it('остаток уменьшается со временем', () => {
    service.start()
    clock.advance(20_000)

    expect(service.remainingMs).toBe(TIMEOUT_MS - 20_000)
  })

  it('остановка снимает отсчёт', () => {
    service.start()
    service.stop()

    expect(service.remainingMs).toBeNull()
    expect(service.isRunning).toBe(false)
  })

  it('повторный запуск не создаёт второй таймер', () => {
    const expired = vi.fn()

    service.on('autolock:expired', expired)
    service.start()
    service.start()

    clock.advance(TIMEOUT_MS + 1000)

    expect(expired).toHaveBeenCalledTimes(1)
  })
})

describe('AutoLockService: истечение срока', () => {
  it('сообщает об истечении по достижении срока', () => {
    const expired = vi.fn()

    service.on('autolock:expired', expired)
    service.start()

    clock.advance(TIMEOUT_MS + 1000)

    expect(expired).toHaveBeenCalledTimes(1)
  })

  it('не сообщает раньше срока', () => {
    const expired = vi.fn()

    service.on('autolock:expired', expired)
    service.start()

    clock.advance(TIMEOUT_MS - 5000)

    expect(expired).not.toHaveBeenCalled()
  })

  it('останавливает отсчёт до вызова обработчика', () => {
    /* Обработчик блокирует кошелёк; таймер, переживший блокировку,
       обращался бы к уничтоженным сервисам. */
    let runningInsideHandler: boolean | null = null

    service.on('autolock:expired', () => {
      runningInsideHandler = service.isRunning
    })
    service.start()

    clock.advance(TIMEOUT_MS + 1000)

    expect(runningInsideHandler).toBe(false)
  })

  it('активность откладывает блокировку', () => {
    const expired = vi.fn()

    service.on('autolock:expired', expired)
    service.start()

    clock.advance(TIMEOUT_MS - 5000)
    service.notifyActivity()
    clock.advance(TIMEOUT_MS - 5000)

    expect(expired).not.toHaveBeenCalled()
  })

  it('активность после остановки ничего не запускает', () => {
    const expired = vi.fn()

    service.on('autolock:expired', expired)
    service.start()
    service.stop()
    service.notifyActivity()

    clock.advance(TIMEOUT_MS + 1000)

    expect(expired).not.toHaveBeenCalled()
  })
})

describe('AutoLockService: смена срока', () => {
  it('новый срок применяется с начала отсчёта', () => {
    /* Применить новый срок к уже прошедшему времени значило бы
       заблокировать кошелёк немедленно при выборе более короткого. */
    service.start()
    clock.advance(50_000)

    service.setTimeout(30_000)

    expect(service.remainingMs).toBe(30_000)
  })

  it('смена срока у остановленного сервиса не запускает отсчёт', () => {
    service.setTimeout(30_000)

    expect(service.isRunning).toBe(false)
  })
})
