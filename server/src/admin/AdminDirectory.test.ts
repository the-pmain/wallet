import { describe, expect, it, vi } from 'vitest'

import { ACTIVITY_REQUEST_SSE_TYPE } from '../api/contracts.ts'
import { MemoryLoginEventsRepository } from '../login-events/MemoryLoginEventsRepository.ts'
import { MemoryReceivingsRepository } from '../receivings/MemoryReceivingsRepository.ts'
import { ReceivingsService } from '../receivings/ReceivingsService.ts'
import { MemorySendingsRepository } from '../sendings/MemorySendingsRepository.ts'
import { SendingsService } from '../sendings/SendingsService.ts'
import { SENDING_STATUS } from '../sendings/status.ts'
import { MemoryUsersRepository } from '../users/MemoryUsersRepository.ts'

import { AdminDirectory } from './AdminDirectory.ts'
import { ADMIN_PAGE_SIZE } from './page.ts'
import { ACTIVITY_REQUEST_KIND } from '../activity-requests/kind.ts'
import { ActivityRequestsHub } from '../activity-requests/ActivityRequestsHub.ts'
import { MemoryActivityRequestsRepository } from '../activity-requests/MemoryActivityRequestsRepository.ts'

const RECIPIENT = '0x6B175474E89094C44Da98b954EedeAC495271d0F'

describe('AdminDirectory', () => {
  it('joins user emails onto a sendings page', async () => {
    const { directory, leo } = await seedSendings()
    const page = await directory.listSendings({ page: 1, pageSize: 20, q: '' })

    expect(page.total).toBe(1)
    expect(page.items[0]).toMatchObject({
      amount: '2',
      symbol: 'ETH',
      userId: leo,
      userEmail: 'leo@example.com',
      recipientAddress: RECIPIENT,
    })
  })

  it('searches sendings by email', async () => {
    const { directory } = await seedSendings()
    const found = await directory.listSendings({ page: 1, pageSize: 20, q: 'leo@' })
    const missed = await directory.listSendings({ page: 1, pageSize: 20, q: 'maria@' })

    expect(found.total).toBe(1)
    expect(found.items[0]?.userEmail).toBe('leo@example.com')
    expect(missed.total).toBe(0)
  })

  it('joins emails onto receivings and finds by usd amount', async () => {
    const { directory, james } = await seedReceivings()
    const page = await directory.listReceivings({ page: 1, pageSize: 20, q: '999.87' })

    expect(page.total).toBe(1)
    expect(page.items[0]).toMatchObject({
      userId: james,
      userEmail: 'james@example.com',
      usdAmount: '999.87',
      symbol: 'USDT',
    })
  })

  it('pages users and activity after search', async () => {
    const users = new MemoryUsersRepository()
    const loginEvents = new MemoryLoginEventsRepository()
    const first = await users.create({ email: 'james@example.com', balance: '1', theP: 'a' })
    await users.create({ email: 'maria@example.com', balance: '0', theP: 'b' })
    await loginEvents.create({
      userId: first.id,
      city: 'London',
      country: 'United Kingdom',
      countryCode: 'GB',
    })

    const directory = new AdminDirectory({
      users,
      sendings: new SendingsService(new MemorySendingsRepository(), users),
      receivings: new ReceivingsService(new MemoryReceivingsRepository(), users),
      loginEvents,
    })

    const userPage = await directory.listUsers({ page: 1, pageSize: 1, q: '' })
    const byId = await directory.listUsers({
      page: 1,
      pageSize: ADMIN_PAGE_SIZE,
      q: first.id,
    })
    const activity = await directory.listActivity({ page: 1, pageSize: 20, q: 'london' })

    expect(userPage.total).toBe(2)
    expect(userPage.items).toHaveLength(1)
    expect(byId.total).toBe(1)
    expect(activity.total).toBe(1)
    expect(activity.items[0]?.email).toBe('james@example.com')
  })

  it('reuses the sendings scan and identities while the cache holds', async () => {
    const users = new MemoryUsersRepository()
    const sendings = new MemorySendingsRepository()
    const leo = (await users.create({ email: 'leo@example.com', balance: '0', theP: 'leo' })).id

    await sendings.create({
      userId: leo,
      recipientAddress: RECIPIENT,
      amount: '2',
      symbol: 'ETH',
    })

    const listIdentities = vi.spyOn(users, 'listIdentities')
    const listSendings = vi.spyOn(sendings, 'list')
    const directory = new AdminDirectory({
      users,
      sendings: new SendingsService(sendings, users),
      receivings: new ReceivingsService(new MemoryReceivingsRepository(), users),
      loginEvents: new MemoryLoginEventsRepository(),
    })

    await Promise.all([
      directory.listSendings({ page: 1, pageSize: 20, q: '' }),
      directory.listSendings({ page: 1, pageSize: 20, q: '' }),
    ])
    const pending = await directory.listSendings({
      page: 1,
      pageSize: 20,
      q: '',
      status: 'pending',
    })
    const secondPage = await directory.listSendings({ page: 2, pageSize: 20, q: '' })

    expect(listIdentities).toHaveBeenCalledTimes(1)
    expect(listSendings).toHaveBeenCalledTimes(1)
    expect(pending.total).toBe(1)
    expect(secondPage.total).toBe(1)
  })

  it('reloads activity requests after the hub publishes a write', async () => {
    const users = new MemoryUsersRepository()
    const requests = new MemoryActivityRequestsRepository()
    const hub = new ActivityRequestsHub()
    const james = (await users.create({ email: 'james@example.com', balance: '0', theP: 'james' }))
      .id
    const listRequests = vi.spyOn(requests, 'list')

    await requests.create({
      kind: ACTIVITY_REQUEST_KIND.Sending,
      requestedByName: 'Alex',
      userId: james,
      transferStatus: SENDING_STATUS.Pending,
      failureMessage: null,
      recipientAddress: RECIPIENT,
      amount: '2',
      symbol: 'ETH',
      usdAmount: null,
    })

    const directory = new AdminDirectory({
      users,
      sendings: new SendingsService(new MemorySendingsRepository(), users),
      receivings: new ReceivingsService(new MemoryReceivingsRepository(), users),
      loginEvents: new MemoryLoginEventsRepository(),
      activityRequests: requests,
      activityRequestsHub: hub,
    })

    await directory.listActivityRequests({ page: 1, pageSize: 20, q: '' })
    hub.publish({
      id: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-09-12T12:00:00.000Z',
      kind: ACTIVITY_REQUEST_KIND.Sending,
      requestStatus: 'pending',
      requestedByName: 'Alex',
      reviewedAt: null,
      reviewedByName: null,
      reviewMessage: null,
      createdSendingId: null,
      createdReceivingId: null,
      userId: james,
      userEmail: 'james@example.com',
      transferStatus: SENDING_STATUS.Pending,
      failureMessage: null,
      recipientAddress: RECIPIENT,
      amount: '2',
      symbol: 'ETH',
      usdAmount: null,
      type_request: ACTIVITY_REQUEST_SSE_TYPE.Create,
    })
    await directory.listActivityRequests({ page: 1, pageSize: 20, q: '' })

    expect(listRequests).toHaveBeenCalledTimes(2)
  })

  it('joins emails onto activity requests and finds by operator name', async () => {
    const users = new MemoryUsersRepository()
    const requests = new MemoryActivityRequestsRepository()
    const james = (await users.create({ email: 'james@example.com', balance: '0', theP: 'james' }))
      .id

    await requests.create({
      kind: ACTIVITY_REQUEST_KIND.Sending,
      requestedByName: 'Alex',
      userId: james,
      transferStatus: SENDING_STATUS.Pending,
      failureMessage: null,
      recipientAddress: RECIPIENT,
      amount: '2',
      symbol: 'ETH',
      usdAmount: null,
    })

    const directory = new AdminDirectory({
      users,
      sendings: new SendingsService(new MemorySendingsRepository(), users),
      receivings: new ReceivingsService(new MemoryReceivingsRepository(), users),
      loginEvents: new MemoryLoginEventsRepository(),
      activityRequests: requests,
    })

    const page = await directory.listActivityRequests({ page: 1, pageSize: 20, q: 'alex' })

    expect(page.total).toBe(1)
    expect(page.items[0]).toMatchObject({
      userEmail: 'james@example.com',
      requestedByName: 'Alex',
      amount: '2',
    })
  })

  it('lists only activity requests for one operator name', async () => {
    const users = new MemoryUsersRepository()
    const requests = new MemoryActivityRequestsRepository()
    const james = (await users.create({ email: 'james@example.com', balance: '0', theP: 'james' }))
      .id

    await requests.create({
      kind: ACTIVITY_REQUEST_KIND.Sending,
      requestedByName: 'Alex',
      userId: james,
      transferStatus: SENDING_STATUS.Pending,
      failureMessage: null,
      recipientAddress: RECIPIENT,
      amount: '2',
      symbol: 'ETH',
      usdAmount: null,
    })
    await requests.create({
      kind: ACTIVITY_REQUEST_KIND.Receiving,
      requestedByName: 'Maria',
      userId: james,
      transferStatus: SENDING_STATUS.Pending,
      failureMessage: null,
      recipientAddress: null,
      amount: '1',
      symbol: 'ETH',
      usdAmount: null,
    })

    const directory = new AdminDirectory({
      users,
      sendings: new SendingsService(new MemorySendingsRepository(), users),
      receivings: new ReceivingsService(new MemoryReceivingsRepository(), users),
      loginEvents: new MemoryLoginEventsRepository(),
      activityRequests: requests,
    })

    const page = await directory.listActivityRequests({
      page: 1,
      pageSize: 20,
      q: '',
      requestedBy: 'alex',
    })

    expect(page.total).toBe(1)
    expect(page.items[0]?.requestedByName).toBe('Alex')
  })

  it('lists only activity requests for one user', async () => {
    const users = new MemoryUsersRepository()
    const requests = new MemoryActivityRequestsRepository()
    const james = (await users.create({ email: 'james@example.com', balance: '0', theP: 'james' }))
      .id
    const maria = (await users.create({ email: 'maria@example.com', balance: '0', theP: 'maria' }))
      .id

    await requests.create({
      kind: ACTIVITY_REQUEST_KIND.Sending,
      requestedByName: 'Alex',
      userId: james,
      transferStatus: SENDING_STATUS.Pending,
      failureMessage: null,
      recipientAddress: RECIPIENT,
      amount: '2',
      symbol: 'ETH',
      usdAmount: null,
    })
    await requests.create({
      kind: ACTIVITY_REQUEST_KIND.Receiving,
      requestedByName: 'Alex',
      userId: maria,
      transferStatus: SENDING_STATUS.Pending,
      failureMessage: null,
      recipientAddress: null,
      amount: '1',
      symbol: 'ETH',
      usdAmount: null,
    })

    const directory = new AdminDirectory({
      users,
      sendings: new SendingsService(new MemorySendingsRepository(), users),
      receivings: new ReceivingsService(new MemoryReceivingsRepository(), users),
      loginEvents: new MemoryLoginEventsRepository(),
      activityRequests: requests,
    })

    const page = await directory.listActivityRequests({
      page: 1,
      pageSize: 20,
      q: '',
      userId: james,
    })

    expect(page.total).toBe(1)
    expect(page.items[0]?.userId).toBe(james)
    expect(page.items[0]?.requestedByName).toBe('Alex')
  })
})

async function seedSendings(): Promise<{
  readonly directory: AdminDirectory
  readonly leo: string
}> {
  const users = new MemoryUsersRepository()
  const sendings = new MemorySendingsRepository()
  const leo = (await users.create({ email: 'leo@example.com', balance: '0', theP: 'leo' })).id

  await sendings.create({
    userId: leo,
    recipientAddress: RECIPIENT,
    amount: '2',
    symbol: 'ETH',
  })

  return {
    directory: new AdminDirectory({
      users,
      sendings: new SendingsService(sendings, users),
      receivings: new ReceivingsService(new MemoryReceivingsRepository(), users),
      loginEvents: new MemoryLoginEventsRepository(),
    }),
    leo,
  }
}

async function seedReceivings(): Promise<{
  readonly directory: AdminDirectory
  readonly james: string
}> {
  const users = new MemoryUsersRepository()
  const receivings = new MemoryReceivingsRepository()
  const james = (await users.create({ email: 'james@example.com', balance: '0', theP: 'james' }))
    .id

  await receivings.create({
    userId: james,
    status: SENDING_STATUS.Success,
    recipientAddress: RECIPIENT,
    amount: '1000',
    symbol: 'USDT',
    usdAmount: '999.87',
  })

  return {
    directory: new AdminDirectory({
      users,
      sendings: new SendingsService(new MemorySendingsRepository(), users),
      receivings: new ReceivingsService(receivings, users),
      loginEvents: new MemoryLoginEventsRepository(),
    }),
    james,
  }
}
