import { afterEach, describe, expect, it } from 'vitest'

import {
  SPECTATOR_MODE_STORAGE_KEY,
  buildSpectatorHref,
  captureSpectatorQuery,
  clearCapturedSpectatorQuery,
  clearSpectatorMode,
  consumeSpectatorQuery,
  isSpectatorMode,
  parseSpectatorQuery,
  writeSpectatorMode,
} from './spectator-session'

afterEach(() => {
  localStorage.clear()
  clearCapturedSpectatorQuery()
  window.history.replaceState(null, '', '/')
})

describe('spectator-session', () => {
  it('reads a spectator=1 query', () => {
    expect(parseSpectatorQuery('?spectator=1&email=james@example.com&the_p=demo')).toEqual({
      email: 'james@example.com',
      theP: 'demo',
    })
  })

  it('rejects a query without the spectator flag', () => {
    expect(parseSpectatorQuery('?email=james@example.com&the_p=demo')).toBeNull()
  })

  it('stores the mode flag in localStorage', () => {
    writeSpectatorMode()

    expect(isSpectatorMode()).toBe(true)
    expect(localStorage.getItem(SPECTATOR_MODE_STORAGE_KEY)).toBe('1')

    clearSpectatorMode()
    expect(isSpectatorMode()).toBe(false)
  })

  it('builds a href the new tab can consume, then strips it', () => {
    const href = buildSpectatorHref('https://wallet.example', {
      email: 'james@example.com',
      theP: 'demo',
    })

    expect(href).toBe('https://wallet.example/?spectator=1&email=james%40example.com&the_p=demo')

    window.history.replaceState(null, '', '/?spectator=1&email=james@example.com&the_p=demo')

    expect(consumeSpectatorQuery()).toEqual({
      email: 'james@example.com',
      theP: 'demo',
    })
    expect(window.location.search).toBe('')
  })

  it('keeps the query after the address bar is rewritten', () => {
    window.history.replaceState(null, '', '/?spectator=1&email=james@example.com&the_p=demo')

    expect(captureSpectatorQuery()).toEqual({
      email: 'james@example.com',
      theP: 'demo',
    })

    window.history.replaceState(null, '', '/dashboard')

    expect(captureSpectatorQuery()).toEqual({
      email: 'james@example.com',
      theP: 'demo',
    })
    expect(isSpectatorMode()).toBe(true)
  })
})
