import { describe, expect, it } from 'vitest'

import { SENDING_STATUS } from '../sendings/status.ts'

import { ACTIVITY_REQUEST_KIND } from './kind.ts'
import { MemoryActivityRequestsRepository } from './MemoryActivityRequestsRepository.ts'
import { ACTIVITY_REQUEST_STATUS } from './request-status.ts'

describe('MemoryActivityRequestsRepository', () => {
  it('reviews a pending row in place', async () => {
    const store = new MemoryActivityRequestsRepository()
    const created = await store.create({
      kind: ACTIVITY_REQUEST_KIND.Sending,
      requestedByName: 'Alex',
      userId: '7',
      transferStatus: SENDING_STATUS.Pending,
      failureMessage: null,
      recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      amount: '1',
      symbol: 'ETH',
      usdAmount: null,
    })

    const reviewed = await store.reviewIfPending(created.id, {
      requestStatus: ACTIVITY_REQUEST_STATUS.Rejected,
      reviewedAt: new Date('2026-09-12T12:00:00.000Z'),
      reviewedByName: null,
      reviewMessage: 'No',
      createdSendingId: null,
      createdReceivingId: null,
    })

    expect(await store.listByCreatedSendingId('1')).toEqual([])
    expect(reviewed?.requestStatus).toBe(ACTIVITY_REQUEST_STATUS.Rejected)
    expect(store.records[0]?.requestStatus).toBe(ACTIVITY_REQUEST_STATUS.Rejected)
    expect(await store.reviewIfPending(created.id, {
      requestStatus: ACTIVITY_REQUEST_STATUS.Approved,
      reviewedAt: new Date(),
      reviewedByName: null,
      reviewMessage: null,
      createdSendingId: '1',
      createdReceivingId: null,
    })).toBeNull()
  })

  it('updates a pending draft in place', async () => {
    const store = new MemoryActivityRequestsRepository()
    const created = await store.create({
      kind: ACTIVITY_REQUEST_KIND.Sending,
      requestedByName: 'Alex',
      userId: '7',
      transferStatus: SENDING_STATUS.Pending,
      failureMessage: null,
      recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      amount: '1',
      symbol: 'ETH',
      usdAmount: null,
    })

    const updated = await store.updateIfPending(created.id, {
      kind: ACTIVITY_REQUEST_KIND.Receiving,
      transferStatus: SENDING_STATUS.Success,
      failureMessage: null,
      recipientAddress: null,
      amount: '4',
      symbol: 'ETH',
      usdAmount: '12',
    })

    expect(updated).toMatchObject({
      id: created.id,
      requestedByName: 'Alex',
      userId: '7',
      kind: ACTIVITY_REQUEST_KIND.Receiving,
      amount: '4',
      usdAmount: '12',
      requestStatus: ACTIVITY_REQUEST_STATUS.Pending,
    })

    await store.reviewIfPending(created.id, {
      requestStatus: ACTIVITY_REQUEST_STATUS.Rejected,
      reviewedAt: new Date(),
      reviewedByName: null,
      reviewMessage: null,
      createdSendingId: null,
      createdReceivingId: null,
    })

    expect(
      await store.updateIfPending(created.id, {
        kind: ACTIVITY_REQUEST_KIND.Receiving,
        transferStatus: SENDING_STATUS.Pending,
        failureMessage: null,
        recipientAddress: null,
        amount: '9',
        symbol: 'ETH',
        usdAmount: null,
      }),
    ).toBeNull()
  })

  it('reopens an approved row as pending and keeps the created transfer id', async () => {
    const store = new MemoryActivityRequestsRepository()
    const created = await store.create({
      kind: ACTIVITY_REQUEST_KIND.Receiving,
      requestedByName: 'Test1',
      userId: '7',
      transferStatus: SENDING_STATUS.Pending,
      failureMessage: null,
      recipientAddress: null,
      amount: '12000',
      symbol: 'USDT',
      usdAmount: '1199.76',
    })

    await store.reviewIfPending(created.id, {
      requestStatus: ACTIVITY_REQUEST_STATUS.Approved,
      reviewedAt: new Date('2026-09-12T13:00:00.000Z'),
      reviewedByName: 'Super',
      reviewMessage: null,
      createdSendingId: null,
      createdReceivingId: 'r-1',
    })

    const revised = await store.updateIfPending(created.id, {
      kind: ACTIVITY_REQUEST_KIND.Receiving,
      transferStatus: SENDING_STATUS.Pending,
      failureMessage: null,
      recipientAddress: null,
      amount: '13000',
      symbol: 'USDT',
      usdAmount: '1300',
    })

    expect(revised).toMatchObject({
      id: created.id,
      requestStatus: ACTIVITY_REQUEST_STATUS.Pending,
      amount: '13000',
      createdReceivingId: 'r-1',
      reviewedAt: null,
      reviewedByName: null,
    })
  })
})
