import { afterEach, describe, expect, it } from 'vitest'

import { ADMIN_NAME_STORAGE_KEY, clearAdminName, readAdminName, writeAdminName } from './admin-name'

afterEach(() => {
  localStorage.clear()
})

describe('admin-name', () => {
  it('записывает и читает имя', () => {
    writeAdminName('Alex')

    expect(localStorage.getItem(ADMIN_NAME_STORAGE_KEY)).toBe('Alex')
    expect(readAdminName()).toBe('Alex')
  })

  it('перезаписывает предыдущее имя', () => {
    writeAdminName('Alex')
    writeAdminName('Maria')

    expect(readAdminName()).toBe('Maria')
  })

  it('отвергает пустую запись', () => {
    localStorage.setItem(ADMIN_NAME_STORAGE_KEY, '   ')
    expect(readAdminName()).toBeNull()
  })

  it('стирает запись', () => {
    writeAdminName('Alex')
    clearAdminName()
    expect(readAdminName()).toBeNull()
  })
})
