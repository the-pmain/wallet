import { describe, expect, it } from 'vitest'

import { MemoryReceivingsRepository } from '../receivings/MemoryReceivingsRepository.ts'
import { ReceivingsService } from '../receivings/ReceivingsService.ts'
import { MemorySendingsRepository } from '../sendings/MemorySendingsRepository.ts'
import { SendingsService } from '../sendings/SendingsService.ts'
import { MemoryUsersRepository } from '../users/MemoryUsersRepository.ts'

import {
  ActivityRequestsConflictError,
  ActivityRequestsForbiddenError,
  ActivityRequestsService,
  ActivityRequestsValidationError,
} from './ActivityRequestsService.ts'
import { ACTIVITY_REQUEST_KIND } from './kind.ts'
import { MemoryActivityRequestsRepository } from './MemoryActivityRequestsRepository.ts'
import { ACTIVITY_REQUEST_STATUS } from './request-status.ts'

const RECIPIENT = '0x6B175474E89094C44Da98b954EedeAC495271d0F'

const ETH = {
  assetChainId: '1',
  assetStandard: 'native' as const,
  assetAddress: null,
  assetName: 'Ether',
  assetDecimals: 18,
  assetIsVerified: true,
}

describe('ActivityRequestsService', () => {
  it('stores a sending request without writing sendings', async () => {
    const { service, sendings, userId } = await setup()

    const record = await service.submit({
      kind: ACTIVITY_REQUEST_KIND.Sending,
      requestedByName: 'Alex',
      userId,
      recipientAddress: RECIPIENT,
      amount: '0.01',
      symbol: 'ETH',
      ...ETH,
    })

    expect(record.requestStatus).toBe(ACTIVITY_REQUEST_STATUS.Pending)
    expect(record.createdSendingId).toBeNull()
    expect(sendings.records).toHaveLength(0)
  })

  it('refuses a sending without a recipient', async () => {
    const { service, userId } = await setup()

    await expect(
      service.submit({
        kind: ACTIVITY_REQUEST_KIND.Sending,
        requestedByName: 'Alex',
        userId,
        amount: '0.01',
        symbol: 'ETH',
        ...ETH,
      }),
    ).rejects.toBeInstanceOf(ActivityRequestsValidationError)
  })

  it('approves a sending by creating the transfer', async () => {
    const { service, sendings, userId } = await setup()
    const request = await service.submit({
      kind: ACTIVITY_REQUEST_KIND.Sending,
      requestedByName: 'Alex',
      userId,
      recipientAddress: RECIPIENT,
      amount: '0.01',
      symbol: 'ETH',
      ...ETH,
    })

    const approved = await service.approve(request.id, { reviewedByName: null })

    expect(approved.requestStatus).toBe(ACTIVITY_REQUEST_STATUS.Approved)
    expect(approved.createdSendingId).not.toBeNull()
    expect(sendings.records[0]?.id).toBe(approved.createdSendingId)
    expect(sendings.records[0]?.amount).toBe('0.01')
  })

  it('rejects without creating a transfer', async () => {
    const { service, sendings, userId } = await setup()
    const request = await service.submit({
      kind: ACTIVITY_REQUEST_KIND.Sending,
      requestedByName: 'Alex',
      userId,
      recipientAddress: RECIPIENT,
      amount: '0.01',
      symbol: 'ETH',
      ...ETH,
    })

    const rejected = await service.reject(request.id, { reviewMessage: 'No' })

    expect(rejected.requestStatus).toBe(ACTIVITY_REQUEST_STATUS.Rejected)
    expect(rejected.reviewMessage).toBe('No')
    expect(sendings.records).toHaveLength(0)
  })

  it('updates a pending draft without creating a transfer', async () => {
    const { service, sendings, userId } = await setup()
    const request = await service.submit({
      kind: ACTIVITY_REQUEST_KIND.Sending,
      requestedByName: 'Alex',
      userId,
      recipientAddress: RECIPIENT,
      amount: '0.01',
      symbol: 'ETH',
      ...ETH,
    })

    const updated = await service.update(request.id, {
      kind: ACTIVITY_REQUEST_KIND.Sending,
      recipientAddress: RECIPIENT,
      amount: '1.25',
      symbol: 'ETH',
      transferStatus: 'success',
      ...ETH,
    })

    expect(updated.amount).toBe('1.25')
    expect(updated.transferStatus).toBe('success')
    expect(updated.requestStatus).toBe(ACTIVITY_REQUEST_STATUS.Pending)
    expect(updated.requestedByName).toBe('Alex')
    expect(updated.userId).toBe(userId)
    expect(sendings.records).toHaveLength(0)
  })

  it('reopens an approved request so Super Admin can review the change', async () => {
    const { service, sendings, userId } = await setup()
    const request = await service.submit({
      kind: ACTIVITY_REQUEST_KIND.Sending,
      requestedByName: 'Alex',
      userId,
      recipientAddress: RECIPIENT,
      amount: '0.01',
      symbol: 'ETH',
      ...ETH,
    })

    const approved = await service.approve(request.id, { reviewedByName: null })

    expect(sendings.records).toHaveLength(1)
    expect(sendings.records[0]?.amount).toBe('0.01')

    const revised = await service.update(approved.id, {
      kind: ACTIVITY_REQUEST_KIND.Sending,
      recipientAddress: RECIPIENT,
      amount: '3',
      symbol: 'ETH',
      ...ETH,
    })

    expect(revised.requestStatus).toBe(ACTIVITY_REQUEST_STATUS.Pending)
    expect(revised.amount).toBe('3')
    expect(revised.createdSendingId).toBe(approved.createdSendingId)
    expect(revised.reviewedAt).toBeNull()
    expect(sendings.records).toHaveLength(1)
    expect(sendings.records[0]?.amount).toBe('0.01')

    const reapproved = await service.approve(revised.id, { reviewedByName: 'Super' })

    expect(reapproved.requestStatus).toBe(ACTIVITY_REQUEST_STATUS.Approved)
    expect(reapproved.createdSendingId).toBe(approved.createdSendingId)
    expect(sendings.records).toHaveLength(1)
    expect(sendings.records[0]?.amount).toBe('3')
  })

  it('does not update a request that is no longer pending', async () => {
    const { service, userId } = await setup()
    const request = await service.submit({
      kind: ACTIVITY_REQUEST_KIND.Receiving,
      requestedByName: 'Alex',
      userId,
      amount: '1',
      symbol: 'ETH',
      ...ETH,
    })

    await service.reject(request.id, {})

    await expect(
      service.update(request.id, {
        kind: ACTIVITY_REQUEST_KIND.Receiving,
        amount: '2',
        symbol: 'ETH',
        ...ETH,
      }),
    ).rejects.toBeInstanceOf(ActivityRequestsConflictError)
  })

  it('lets Super Admin cancel a pending request', async () => {
    const { service, userId } = await setup()
    const request = await service.submit({
      kind: ACTIVITY_REQUEST_KIND.Receiving,
      requestedByName: 'Alex',
      userId,
      amount: '1',
      symbol: 'ETH',
      usdAmount: '10',
      ...ETH,
    })

    const cancelled = await service.cancel(
      request.id,
      { reviewedByName: 'Alex' },
      { requireRequesterName: true },
    )

    expect(cancelled.requestStatus).toBe(ACTIVITY_REQUEST_STATUS.Cancelled)
  })

  it('refuses a cancel from a different operator', async () => {
    const { service, userId } = await setup()
    const request = await service.submit({
      kind: ACTIVITY_REQUEST_KIND.Receiving,
      requestedByName: 'Alex',
      userId,
      amount: '1',
      symbol: 'ETH',
      ...ETH,
    })

    await expect(
      service.cancel(request.id, { reviewedByName: 'Maria' }, { requireRequesterName: true }),
    ).rejects.toBeInstanceOf(ActivityRequestsForbiddenError)
  })

  it('does not review a request twice', async () => {
    const { service, userId } = await setup()
    const request = await service.submit({
      kind: ACTIVITY_REQUEST_KIND.Receiving,
      requestedByName: 'Alex',
      userId,
      amount: '1',
      symbol: 'ETH',
      ...ETH,
    })

    await service.reject(request.id, {})

    await expect(service.approve(request.id, {})).rejects.toBeInstanceOf(
      ActivityRequestsConflictError,
    )
  })
})

async function setup(): Promise<{
  readonly service: ActivityRequestsService
  readonly sendings: MemorySendingsRepository
  readonly userId: string
}> {
  const users = new MemoryUsersRepository()
  const sendings = new MemorySendingsRepository()
  const receivings = new MemoryReceivingsRepository()
  const requests = new MemoryActivityRequestsRepository()
  const user = await users.create({ email: 'james@example.com', balance: '0', theP: 'demo' })

  return {
    service: new ActivityRequestsService(
      requests,
      users,
      new SendingsService(sendings, users),
      new ReceivingsService(receivings, users),
    ),
    sendings,
    userId: user.id,
  }
}
