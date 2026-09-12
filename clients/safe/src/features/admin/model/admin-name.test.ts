import { afterEach, describe, expect, it } from 'vitest'

import { ADMIN_NAME_STORAGE_KEY, clearAdminName, readAdminName, writeAdminName } from './admin-name'

afterEach(() => {
  localStorage.clear()
})

describe('admin-name', () => {
  it('writes and reads the name', () => {
    writeAdminName('Alex')

    expect(localStorage.getItem(ADMIN_NAME_STORAGE_KEY)).toBe('Alex')
    expect(readAdminName()).toBe('Alex')
  })

  it('overwrites a previous name', () => {
    writeAdminName('Alex')
    writeAdminName('Maria')

    expect(readAdminName()).toBe('Maria')
  })

  it('rejects an empty record', () => {
    localStorage.setItem(ADMIN_NAME_STORAGE_KEY, '   ')
    expect(readAdminName()).toBeNull()
  })

  it('clears the record', () => {
    writeAdminName('Alex')
    clearAdminName()
    expect(readAdminName()).toBeNull()
  })
})
