import { describe, expect, it, vi } from 'vitest'

import { ACTIVITY_REQUEST_SSE_TYPE } from '../api/contracts.ts'

import { ActivityRequestsHub, formatActivityRequestsSseFrame } from './ActivityRequestsHub.ts'

const EVENT = {
  id: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-09-12T12:00:00.000Z',
  kind: 'sending' as const,
  requestStatus: 'pending' as const,
  requestedByName: 'Alex',
  reviewedAt: null,
  reviewedByName: null,
  reviewMessage: null,
  createdSendingId: null,
  createdReceivingId: null,
  userId: '7',
  userEmail: 'james@example.com',
  transferStatus: 'pending' as const,
  failureMessage: null,
  recipientAddress: '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
  amount: '0.01',
  symbol: 'ETH',
  usdAmount: null,
  type_request: ACTIVITY_REQUEST_SSE_TYPE.Create,
}

describe('ActivityRequestsHub', () => {
  it('sends every event to each subscriber', () => {
    const hub = new ActivityRequestsHub()
    const send = vi.fn()
    hub.subscribe(send)
    hub.publish(EVENT)
    expect(send).toHaveBeenCalledOnce()
    expect(send).toHaveBeenCalledWith(EVENT)
  })

  it('after unsubscribe no longer calls the listener', () => {
    const hub = new ActivityRequestsHub()
    const send = vi.fn()
    const unsubscribe = hub.subscribe(send)
    unsubscribe()
    hub.publish(EVENT)
    expect(send).not.toHaveBeenCalled()
    expect(hub.size).toBe(0)
  })

  it('formats an SSE frame with name activity-requests and type_request', () => {
    expect(formatActivityRequestsSseFrame(EVENT)).toBe(
      `event: activity-requests\ndata: ${JSON.stringify(EVENT)}\n\n`,
    )
  })
})
