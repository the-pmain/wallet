import { afterEach, describe, expect, it, vi } from 'vitest'

import { SENDING_STATUS } from '@/features/onboarding'

import {
  listenForAdminUserRefresh,
  requestAdminUserRefresh,
  settlementChanged,
} from './admin-user-refresh'

describe('admin-user-refresh', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('treats any transition that touches success as a settlement change', () => {
    expect(
      settlementChanged({ status: SENDING_STATUS.Pending }, { status: SENDING_STATUS.Success }),
    ).toBe(true)
    expect(
      settlementChanged({ status: SENDING_STATUS.Success }, { status: SENDING_STATUS.Failure }),
    ).toBe(true)
    expect(
      settlementChanged({ status: SENDING_STATUS.Success }, { status: SENDING_STATUS.Success }),
    ).toBe(true)
    expect(
      settlementChanged({ status: SENDING_STATUS.Pending }, { status: SENDING_STATUS.Failure }),
    ).toBe(false)
  })

  it('notifies only the matching user profile', () => {
    const matching = vi.fn()
    const other = vi.fn()
    const stopMatching = listenForAdminUserRefresh('7', matching)
    const stopOther = listenForAdminUserRefresh('8', other)

    requestAdminUserRefresh(null)
    requestAdminUserRefresh('7')

    expect(matching).toHaveBeenCalledTimes(1)
    expect(other).not.toHaveBeenCalled()

    stopMatching()
    stopOther()
  })
})
