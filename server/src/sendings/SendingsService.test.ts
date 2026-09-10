import { describe, expect, it } from 'vitest'

import { ASSET_STANDARD } from '../users/assets.ts'
import { MemoryUsersRepository } from '../users/MemoryUsersRepository.ts'
import { MemorySendingsRepository } from './MemorySendingsRepository.ts'
import { SendingsService, SendingsValidationError } from './SendingsService.ts'
import { SENDING_STATUS } from './status.ts'

const RECIPIENT = '0x0000000000000000000000000000000000000002'

describe('SendingsService settlement', () => {
  it('debits pending to success and reverses success to failure', async () => {
    const { service, users } = await setup()
    const created = await service.registerByAdmin({
      userId: '1',
      status: SENDING_STATUS.Pending,
      recipientAddress: RECIPIENT,
      amount: '0.5',
      symbol: 'ETH',
    })

    await service.update(created.id, {
      status: SENDING_STATUS.Success,
      failureMessage: null,
      recipientAddress: RECIPIENT,
      amount: '0.5',
      symbol: 'ETH',
    })
    expect((await users.findById('1'))?.assets.tokens[0]?.balance).toBe('1500000000000000000')

    await service.update(created.id, {
      status: SENDING_STATUS.Failure,
      failureMessage: 'failed',
      recipientAddress: RECIPIENT,
      amount: '0.5',
      symbol: 'ETH',
    })
    expect((await users.findById('1'))?.assets.tokens[0]?.balance).toBe('2000000000000000000')
  })

  it('reconciles success edits exactly and is idempotent', async () => {
    const { service, users } = await setup()
    const created = await service.registerByAdmin({
      userId: '1',
      status: SENDING_STATUS.Success,
      recipientAddress: RECIPIENT,
      amount: '0.5',
      symbol: 'ETH',
    })
    const patch = {
      status: SENDING_STATUS.Success,
      failureMessage: null,
      recipientAddress: RECIPIENT,
      amount: '1.25',
      symbol: 'ETH',
    } as const

    await service.update(created.id, patch)
    await service.update(created.id, patch)

    expect((await users.findById('1'))?.assets.tokens[0]?.balance).toBe('750000000000000000')
  })

  it('deletes a pending sending without changing the holding', async () => {
    const { service, users } = await setup()
    const created = await service.registerByAdmin({
      userId: '1',
      status: SENDING_STATUS.Pending,
      recipientAddress: RECIPIENT,
      amount: '0.5',
      symbol: 'ETH',
    })

    await expect(service.remove(created.id)).resolves.toMatchObject({ id: created.id })
    await expect(service.remove(created.id)).resolves.toBeNull()
    expect((await users.findById('1'))?.assets.tokens[0]?.balance).toBe('2000000000000000000')
  })

  it('credits the holding back when a successful sending is deleted', async () => {
    const { service, users } = await setup()
    const created = await service.registerByAdmin({
      userId: '1',
      status: SENDING_STATUS.Success,
      recipientAddress: RECIPIENT,
      amount: '0.5',
      symbol: 'ETH',
    })
    expect((await users.findById('1'))?.assets.tokens[0]?.balance).toBe('1500000000000000000')

    await expect(service.remove(created.id)).resolves.toMatchObject({ id: created.id })
    expect((await users.findById('1'))?.assets.tokens[0]?.balance).toBe('2000000000000000000')
  })

  it('rejects insufficient funds and excess decimal precision without clamping', async () => {
    const { service, users } = await setup()
    const excessive = service.registerByAdmin({
      userId: '1',
      status: SENDING_STATUS.Success,
      recipientAddress: RECIPIENT,
      amount: '3',
      symbol: 'ETH',
    })
    await expect(excessive).rejects.toBeInstanceOf(SendingsValidationError)
    expect((await users.findById('1'))?.assets.tokens[0]?.balance).toBe('2000000000000000000')

    await expect(
      service.registerByAdmin({
        userId: '1',
        status: SENDING_STATUS.Success,
        recipientAddress: RECIPIENT,
        amount: '0.0000000000000000001',
        symbol: 'ETH',
      }),
    ).rejects.toBeInstanceOf(SendingsValidationError)
    expect((await users.findById('1'))?.assets.tokens[0]?.balance).toBe('2000000000000000000')
  })

  it('accepts a non-EVM wallet address as the recipient', async () => {
    const { service } = await setup()
    const created = await service.registerByAdmin({
      userId: '1',
      status: SENDING_STATUS.Pending,
      recipientAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      amount: '0.1',
      symbol: 'ETH',
    })

    expect(created.recipientAddress).toBe('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')
  })

  it('rejects a string that is not a crypto wallet address', async () => {
    const { service } = await setup()

    await expect(
      service.registerByAdmin({
        userId: '1',
        status: SENDING_STATUS.Pending,
        recipientAddress: 'not-a-wallet',
        amount: '0.1',
        symbol: 'ETH',
      }),
    ).rejects.toBeInstanceOf(SendingsValidationError)
  })
})

async function setup() {
  const users = new MemoryUsersRepository()
  await users.create({
    email: 'owner@example.com',
    balance: '0',
    theP: 'secret',
    assets: {
      quoteCurrency: 'USD',
      updatedAt: '2026-09-10T00:00:00.000Z',
      tokens: [
        {
          chainId: '1',
          standard: ASSET_STANDARD.Native,
          address: null,
          symbol: 'ETH',
          name: 'Ether',
          decimals: 18,
          balance: '2000000000000000000',
          isVerified: true,
        },
      ],
    },
  })
  return {
    users,
    service: new SendingsService(new MemorySendingsRepository(), users),
  }
}
