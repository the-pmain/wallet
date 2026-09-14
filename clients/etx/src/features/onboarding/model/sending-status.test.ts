import { describe, expect, it } from 'vitest'

import { SENDING_STATUS, sendingStatusSelectTone } from './sending-status'

describe('sendingStatusSelectTone', () => {
  it('uses warning for pending', () => {
    expect(sendingStatusSelectTone(SENDING_STATUS.Pending)).toBe('warning')
  })

  it('uses success and danger for the settled statuses', () => {
    expect(sendingStatusSelectTone(SENDING_STATUS.Success)).toBe('success')
    expect(sendingStatusSelectTone(SENDING_STATUS.Failure)).toBe('danger')
  })
})
