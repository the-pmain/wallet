import { describe, expect, it } from 'vitest'

import type { IAdminDirectoryActivityRequest } from './admin-page'
import { ACTIVITY_REQUEST_SSE_TYPE, type IActivityRequestSseEvent } from './activity-request-sse'
import {
  applyLiveRequestEvent,
  dismissedRequestKey,
  hydrateRequestQueue,
  isOperatorDecisionToast,
  operatorNamesMatch,
  requestAmountLabel,
  requestToastTitle,
} from './admin-request-toasts'

const PENDING: IAdminDirectoryActivityRequest = {
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
}

function event(
  request: IAdminDirectoryActivityRequest,
  typeRequest: (typeof ACTIVITY_REQUEST_SSE_TYPE)[keyof typeof ACTIVITY_REQUEST_SSE_TYPE],
): IActivityRequestSseEvent {
  return { ...request, type_request: typeRequest }
}

describe('applyLiveRequestEvent', () => {
  it('puts a create frame at the front of the queue', () => {
    const next = applyLiveRequestEvent([], event(PENDING, ACTIVITY_REQUEST_SSE_TYPE.Create))

    expect(next).toEqual([{ ...PENDING, liveType: 'create' }])
  })

  it('shows approved, rejected, and cancelled creates', () => {
    for (const requestStatus of ['approved', 'rejected', 'cancelled'] as const) {
      const next = applyLiveRequestEvent(
        [],
        event({ ...PENDING, requestStatus }, ACTIVITY_REQUEST_SSE_TYPE.Create),
      )

      expect(next).toHaveLength(1)
      expect(next[0]?.requestStatus).toBe(requestStatus)
    }
  })

  it('does not duplicate the same id', () => {
    const next = applyLiveRequestEvent(
      [PENDING],
      event({ ...PENDING, amount: '3' }, ACTIVITY_REQUEST_SSE_TYPE.Create),
    )

    expect(next).toHaveLength(1)
    expect(next[0]?.amount).toBe('3')
  })

  it('replaces a pending card when the status changes', () => {
    const next = applyLiveRequestEvent(
      [PENDING],
      event({ ...PENDING, requestStatus: 'approved' }, ACTIVITY_REQUEST_SSE_TYPE.Update),
    )

    expect(next).toEqual([{ ...PENDING, requestStatus: 'approved', liveType: 'update' }])
  })

  it('resurfaces a dismissed pending draft after an update', () => {
    const dismissed = new Set([dismissedRequestKey(PENDING.id, 'pending')])
    const next = applyLiveRequestEvent(
      [],
      event({ ...PENDING, amount: '3' }, ACTIVITY_REQUEST_SSE_TYPE.Update),
      dismissed,
    )

    expect(next).toEqual([{ ...PENDING, amount: '3', liveType: 'update' }])
  })

  it('does not restore a dismissed approved snapshot', () => {
    const dismissed = new Set([dismissedRequestKey(PENDING.id, 'approved')])
    const next = applyLiveRequestEvent(
      [],
      event({ ...PENDING, requestStatus: 'approved' }, ACTIVITY_REQUEST_SSE_TYPE.Update),
      dismissed,
    )

    expect(next).toEqual([])
  })

  it('shows a later status after the previous snapshot was dismissed', () => {
    const dismissed = new Set([dismissedRequestKey(PENDING.id, 'pending')])
    const next = applyLiveRequestEvent(
      [],
      event({ ...PENDING, requestStatus: 'rejected' }, ACTIVITY_REQUEST_SSE_TYPE.Update),
      dismissed,
    )

    expect(next).toEqual([{ ...PENDING, requestStatus: 'rejected', liveType: 'update' }])
  })
})

describe('hydrateRequestQueue', () => {
  it('keeps live-only cards and listed pendings', () => {
    const approved = { ...PENDING, id: 'approved-1', requestStatus: 'approved' as const }
    const next = hydrateRequestQueue([approved], [PENDING])

    expect(next.map((item) => item.id).sort()).toEqual([PENDING.id, approved.id].sort())
  })

  it('skips a dismissed pending from the directory', () => {
    const dismissed = new Set([dismissedRequestKey(PENDING.id, 'pending')])
    const next = hydrateRequestQueue([], [PENDING], dismissed)

    expect(next).toEqual([])
  })
})

describe('isOperatorDecisionToast', () => {
  it('matches approve and reject for the signed-in name', () => {
    expect(operatorNamesMatch('Alex', ' alex ')).toBe(true)
    expect(operatorNamesMatch('Alex', 'Maria')).toBe(false)
    expect(operatorNamesMatch('', 'Alex')).toBe(false)
    expect(
      isOperatorDecisionToast({ ...PENDING, requestStatus: 'approved' }, 'Alex'),
    ).toBe(true)
    expect(
      isOperatorDecisionToast({ ...PENDING, requestStatus: 'rejected' }, 'alex'),
    ).toBe(true)
    expect(isOperatorDecisionToast(PENDING, 'Alex')).toBe(false)
    expect(
      isOperatorDecisionToast({ ...PENDING, requestStatus: 'cancelled' }, 'Alex'),
    ).toBe(false)
    expect(
      isOperatorDecisionToast({ ...PENDING, requestStatus: 'approved' }, 'Maria'),
    ).toBe(false)
  })
})

describe('request copy', () => {
  it('joins amount and ticker', () => {
    expect(requestAmountLabel(PENDING)).toBe('0.01 ETH')
  })

  it('names every status for sending and receiving', () => {
    expect(requestToastTitle(PENDING)).toBe('Pending sending request')
    expect(requestToastTitle({ ...PENDING, liveType: 'update' })).toBe('Updated sending request')
    expect(requestToastTitle({ ...PENDING, kind: 'receiving' })).toBe('Awaiting receiving request')
    expect(requestToastTitle({ ...PENDING, requestStatus: 'approved' })).toBe(
      'Sending request approved',
    )
    expect(
      requestToastTitle({ ...PENDING, kind: 'receiving', requestStatus: 'rejected' }),
    ).toBe('Receiving request rejected')
    expect(requestToastTitle({ ...PENDING, requestStatus: 'cancelled' })).toBe(
      'Sending request cancelled',
    )
  })
})
