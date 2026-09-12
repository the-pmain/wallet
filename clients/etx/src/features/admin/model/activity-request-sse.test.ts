import { describe, expect, it } from 'vitest'

import { ACTIVITY_REQUEST_SSE_TYPE, parseActivityRequestSseEvent } from './activity-request-sse'

const CREATE = {
  id: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-09-12T12:00:00.000Z',
  kind: 'sending',
  requestStatus: 'pending',
  requestedByName: 'Alex',
  reviewedAt: null,
  reviewedByName: null,
  reviewMessage: null,
  createdSendingId: null,
  createdReceivingId: null,
  userId: '7',
  userEmail: 'james@example.com',
  transferStatus: 'pending',
  failureMessage: null,
  recipientAddress: '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
  amount: '0.01',
  symbol: 'ETH',
  usdAmount: null,
  type_request: ACTIVITY_REQUEST_SSE_TYPE.Create,
}

describe('parseActivityRequestSseEvent', () => {
  it('keeps a create frame', () => {
    expect(parseActivityRequestSseEvent(JSON.stringify(CREATE))).toEqual(CREATE)
  })

  it('keeps an update frame with a later status', () => {
    const update = {
      ...CREATE,
      requestStatus: 'approved',
      type_request: ACTIVITY_REQUEST_SSE_TYPE.Update,
    }

    expect(parseActivityRequestSseEvent(JSON.stringify(update))).toEqual(update)
  })

  it('drops a frame without type_request', () => {
    const { type_request: _type, ...rest } = CREATE

    expect(parseActivityRequestSseEvent(JSON.stringify(rest))).toBeNull()
  })

  it('drops broken JSON', () => {
    expect(parseActivityRequestSseEvent('not-json')).toBeNull()
  })
})
