import { describe, expect, it } from 'vitest'

import { RUNTIME_MODE } from '../config.ts'
import { isAdminAddressAllowed } from './address.ts'

const ALLOWED = ['185.238.203.103', '185.238.203.200'] as const

describe('isAdminAddressAllowed', () => {
  it('in development and test an empty list allows any address', () => {
    expect(isAdminAddressAllowed('8.8.8.8', [], RUNTIME_MODE.Development)).toBe(true)
    expect(isAdminAddressAllowed('8.8.8.8', [], RUNTIME_MODE.Test)).toBe(true)
  })

  it('in production an empty list allows only loopback', () => {
    expect(isAdminAddressAllowed('185.238.203.103', [], RUNTIME_MODE.Production)).toBe(false)
    expect(isAdminAddressAllowed('8.8.8.8', [], RUNTIME_MODE.Production)).toBe(false)
    expect(isAdminAddressAllowed('127.0.0.1', [], RUNTIME_MODE.Production)).toBe(true)
  })

  it('accepts a listed address in every mode', () => {
    expect(isAdminAddressAllowed('185.238.203.103', ALLOWED, RUNTIME_MODE.Production)).toBe(true)
    expect(isAdminAddressAllowed('185.238.203.200', ALLOWED, RUNTIME_MODE.Test)).toBe(true)
    expect(isAdminAddressAllowed('::ffff:185.238.203.103', ALLOWED, RUNTIME_MODE.Production)).toBe(
      true,
    )
  })

  it('refuses an unlisted remote address', () => {
    expect(isAdminAddressAllowed('8.8.8.8', ALLOWED, RUNTIME_MODE.Production)).toBe(false)
    expect(isAdminAddressAllowed('8.8.8.8', ALLOWED, RUNTIME_MODE.Test)).toBe(false)
  })

  it('accepts loopback in every mode when a list is set', () => {
    expect(isAdminAddressAllowed('127.0.0.1', ALLOWED, RUNTIME_MODE.Development)).toBe(true)
    expect(isAdminAddressAllowed('127.0.0.1', ALLOWED, RUNTIME_MODE.Test)).toBe(true)
    expect(isAdminAddressAllowed('127.0.0.1', ALLOWED, RUNTIME_MODE.Production)).toBe(true)
    expect(isAdminAddressAllowed('::1', ALLOWED, RUNTIME_MODE.Production)).toBe(true)
    expect(isAdminAddressAllowed('::ffff:127.0.0.1', ALLOWED, RUNTIME_MODE.Production)).toBe(true)
  })

  it('refuses a value that is not an address', () => {
    expect(isAdminAddressAllowed('localhost', ALLOWED, RUNTIME_MODE.Production)).toBe(false)
  })
})
