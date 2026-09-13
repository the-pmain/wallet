import { describe, expect, it } from 'vitest'

import { isValidIp, normalizeIp } from './ip.ts'

describe('normalizeIp', () => {
  it('trims and unwraps brackets', () => {
    expect(normalizeIp('  185.238.203.103  ')).toBe('185.238.203.103')
    expect(normalizeIp('[::1]')).toBe('::1')
  })

  it('treats IPv4-mapped IPv6 as IPv4', () => {
    expect(normalizeIp('::ffff:185.238.203.103')).toBe('185.238.203.103')
    expect(normalizeIp('::FFFF:185.238.203.103')).toBe('185.238.203.103')
  })

  it('lowercases IPv6', () => {
    expect(normalizeIp('2001:DB8::1')).toBe('2001:db8::1')
  })
})

describe('isValidIp', () => {
  it('accepts IPv4 and IPv6', () => {
    expect(isValidIp('185.238.203.103')).toBe(true)
    expect(isValidIp('::1')).toBe(true)
    expect(isValidIp('2001:db8::1')).toBe(true)
  })

  it('rejects hostnames, CIDR, and junk', () => {
    expect(isValidIp('localhost')).toBe(false)
    expect(isValidIp('185.238.203.0/24')).toBe(false)
    expect(isValidIp('185.238.203')).toBe(false)
    expect(isValidIp('')).toBe(false)
  })
})
