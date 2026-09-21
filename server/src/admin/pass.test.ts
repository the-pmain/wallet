import { afterEach, describe, expect, it } from 'vitest'

import { passMatches, resolveAdminRole } from './pass.ts'

const previousAdmin = process.env['ADMIN_PASS']
const previousSuper = process.env['SUPER_ADMIN_PASS']

function setPass(name: 'ADMIN_PASS' | 'SUPER_ADMIN_PASS', value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name]

    return
  }

  process.env[name] = value
}

afterEach(() => {
  if (previousAdmin === undefined) {
    delete process.env['ADMIN_PASS']
  } else {
    process.env['ADMIN_PASS'] = previousAdmin
  }

  if (previousSuper === undefined) {
    delete process.env['SUPER_ADMIN_PASS']
  } else {
    process.env['SUPER_ADMIN_PASS'] = previousSuper
  }
})

describe('admin pass', () => {
  it('accepts ADMIN_PASS as the admin role', () => {
    setPass('ADMIN_PASS', 'test-admin-pass')
    setPass('SUPER_ADMIN_PASS', undefined)

    expect(resolveAdminRole('test-admin-pass')).toBe('admin')
    expect(passMatches('test-admin-pass')).toBe(true)
  })

  it('accepts SUPER_ADMIN_PASS as the super role', () => {
    setPass('ADMIN_PASS', undefined)
    setPass('SUPER_ADMIN_PASS', 'test-super-pass')

    expect(resolveAdminRole('test-super-pass')).toBe('super')
    expect(passMatches('test-super-pass')).toBe(true)
  })

  it('returns super when both passwords match', () => {
    setPass('ADMIN_PASS', 'same-pass')
    setPass('SUPER_ADMIN_PASS', 'same-pass')

    expect(resolveAdminRole('same-pass')).toBe('super')
  })

  it('distinguishes the two roles', () => {
    setPass('ADMIN_PASS', 'abcd')
    setPass('SUPER_ADMIN_PASS', 'wxyz')

    expect(resolveAdminRole('abcd')).toBe('admin')
    expect(resolveAdminRole('wxyz')).toBe('super')
  })

  it('rejects another value of the same length', () => {
    setPass('ADMIN_PASS', 'abcd')
    setPass('SUPER_ADMIN_PASS', undefined)

    expect(passMatches('wxyz')).toBe(false)
  })

  it('rejects a value of a different length', () => {
    setPass('ADMIN_PASS', 'abcd')
    setPass('SUPER_ADMIN_PASS', undefined)

    expect(passMatches('ab')).toBe(false)
    expect(passMatches('abcde')).toBe(false)
  })

  it('rejects everything while both passwords are empty', () => {
    setPass('ADMIN_PASS', undefined)
    setPass('SUPER_ADMIN_PASS', undefined)

    expect(passMatches('abcd')).toBe(false)
    expect(passMatches('')).toBe(false)
  })
})
