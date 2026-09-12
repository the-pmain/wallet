import { afterEach, describe, expect, it } from 'vitest'

import {
  ADMIN_PINNED_USERS_STORAGE_KEY,
  pinUser,
  readPinnedUserIds,
  unpinUser,
} from './admin-pinned-users'

afterEach(() => {
  localStorage.clear()
})

describe('admin-pinned-users', () => {
  it('pins a user at the front and does not duplicate', () => {
    expect(pinUser('8')).toEqual(['8'])
    expect(pinUser('7')).toEqual(['7', '8'])
    expect(pinUser('8')).toEqual(['8', '7'])
    expect(localStorage.getItem(ADMIN_PINNED_USERS_STORAGE_KEY)).toBe(JSON.stringify(['8', '7']))
    expect(readPinnedUserIds()).toEqual(['8', '7'])
  })

  it('unpins a user and ignores a missing id', () => {
    pinUser('7')
    pinUser('8')

    expect(unpinUser('7')).toEqual(['8'])
    expect(unpinUser('7')).toEqual(['8'])
    expect(readPinnedUserIds()).toEqual(['8'])
  })

  it('treats a corrupt record as empty', () => {
    localStorage.setItem(ADMIN_PINNED_USERS_STORAGE_KEY, '{')
    expect(readPinnedUserIds()).toEqual([])

    localStorage.setItem(ADMIN_PINNED_USERS_STORAGE_KEY, '["7", 8, "", "7"]')
    expect(readPinnedUserIds()).toEqual(['7'])
  })
})
