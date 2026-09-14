import { afterEach, describe, expect, it } from 'vitest'

import { readLoginCredentials, writeLoginCredentials } from './login-credentials'
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
      clear: false,
    })
    expect(
      parseSpectatorQuery('?spectator=1&clear=1&email=james@example.com&the_p=demo'),
    ).toEqual({
      email: 'james@example.com',
      theP: 'demo',
      clear: true,
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

    expect(href).toBe(
      'https://wallet.example/?spectator=1&clear=1&email=james%40example.com&the_p=demo',
    )

    window.history.replaceState(
      null,
      '',
      '/?spectator=1&clear=1&email=james@example.com&the_p=demo',
    )

    expect(consumeSpectatorQuery()).toEqual({
      email: 'james@example.com',
      theP: 'demo',
      clear: true,
    })
    expect(window.location.search).toBe('')
  })

  it('keeps the query after the address bar is rewritten', () => {
    window.history.replaceState(null, '', '/?spectator=1&email=james@example.com&the_p=demo')

    expect(captureSpectatorQuery()).toEqual({
      email: 'james@example.com',
      theP: 'demo',
      clear: false,
    })

    window.history.replaceState(null, '', '/dashboard')

    expect(captureSpectatorQuery()).toEqual({
      email: 'james@example.com',
      theP: 'demo',
      clear: false,
    })
    expect(isSpectatorMode()).toBe(true)
  })

  it('clear=1 drops the previous directory sign-in', () => {
    writeLoginCredentials({
      id: '8',
      email: 'maria@example.com',
      theP: 'old',
    })
    window.history.replaceState(
      null,
      '',
      '/?spectator=1&clear=1&email=james@example.com&the_p=demo',
    )

    expect(captureSpectatorQuery()).toEqual({
      email: 'james@example.com',
      theP: 'demo',
      clear: true,
    })
    expect(readLoginCredentials()).toBeNull()
  })

  it('drops a previous sign-in when the spectator email differs', () => {
    writeLoginCredentials({
      id: '8',
      email: 'maria@example.com',
      theP: 'old',
    })
    window.history.replaceState(null, '', '/?spectator=1&email=james@example.com&the_p=demo')

    expect(captureSpectatorQuery()?.email).toBe('james@example.com')
    expect(readLoginCredentials()).toBeNull()
  })
})
