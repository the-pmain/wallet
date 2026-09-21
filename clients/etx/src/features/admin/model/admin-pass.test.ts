import { afterEach, describe, expect, it } from 'vitest'

import { ADMIN_PASS_STORAGE_KEY, clearAdminPass, readAdminPass, writeAdminPass } from './admin-pass'

afterEach(() => {
  localStorage.clear()
})

describe('admin-pass', () => {
  it('writes and reads the password', () => {
    writeAdminPass('9100')

    expect(localStorage.getItem(ADMIN_PASS_STORAGE_KEY)).toBe('9100')
    expect(readAdminPass()).toBe('9100')
  })

  it('rejects an empty record', () => {
    localStorage.setItem(ADMIN_PASS_STORAGE_KEY, '   ')
    expect(readAdminPass()).toBeNull()
  })

  it('clears the record', () => {
    writeAdminPass('9100')
    clearAdminPass()
    expect(readAdminPass()).toBeNull()
  })

  it('drops a leftover cabinet PIN', () => {
    localStorage.setItem('etwallet.admin-pin', '9100')
    expect(readAdminPass()).toBeNull()
    expect(localStorage.getItem('etwallet.admin-pin')).toBeNull()
  })
})
