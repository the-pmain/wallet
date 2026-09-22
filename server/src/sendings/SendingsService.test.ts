import { describe, expect, it, vi } from 'vitest'

import { ASSET_STANDARD } from '../users/assets.ts'
import {
  BITCOIN_DECIMALS,
  BITCOIN_LEDGER_CHAIN_ID,
  BITCOIN_NAME,
  BITCOIN_SYMBOL,
} from '../users/ledger-assets.ts'
import { MemoryUsersRepository } from '../users/MemoryUsersRepository.ts'
import type { ISendingRecord } from './contracts.ts'
import { MemorySendingsRepository } from './MemorySendingsRepository.ts'
import { SendingsService, SendingsValidationError } from './SendingsService.ts'
import { SENDING_STATUS } from './status.ts'
import { SendingsDatabaseError } from './SupabaseRestSendingsRepository.ts'

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
    await expect(excessive).rejects.toThrow('Insufficient ETH balance.')
    expect((await users.findById('1'))?.assets.tokens[0]?.balance).toBe('2000000000000000000')

    await expect(
      service.registerByAdmin({
        userId: '1',
        status: SENDING_STATUS.Pending,
        recipientAddress: RECIPIENT,
        amount: '3',
        symbol: 'ETH',
      }),
    ).rejects.toThrow('Insufficient ETH balance.')
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

  it('rejects a sending for an asset the user does not hold', async () => {
    const { service, users } = await setup()

    await expect(
      service.registerByAdmin({
        userId: '1',
        status: SENDING_STATUS.Pending,
        recipientAddress: RECIPIENT,
        amount: '1',
        symbol: 'USDC',
        assetChainId: '1',
        assetStandard: 'ERC-20',
        assetAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        assetName: 'USD Coin',
        assetDecimals: 6,
        assetIsVerified: true,
      }),
    ).rejects.toThrow('Asset was not found in the user portfolio.')
    expect((await users.findById('1'))?.assets.tokens[0]?.balance).toBe('2000000000000000000')
  })

  it('rejects raising a pending sending above the holding', async () => {
    const { service } = await setup()
    const created = await service.registerByAdmin({
      userId: '1',
      status: SENDING_STATUS.Pending,
      recipientAddress: RECIPIENT,
      amount: '0.5',
      symbol: 'ETH',
    })

    await expect(
      service.update(created.id, {
        status: SENDING_STATUS.Pending,
        failureMessage: null,
        recipientAddress: RECIPIENT,
        amount: '3',
        symbol: 'ETH',
      }),
    ).rejects.toThrow('Insufficient ETH balance.')
  })

  it('debits bitcoin in satoshis and refuses an extra decimal', async () => {
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
            chainId: BITCOIN_LEDGER_CHAIN_ID,
            standard: ASSET_STANDARD.Native,
            address: null,
            symbol: BITCOIN_SYMBOL,
            name: BITCOIN_NAME,
            decimals: BITCOIN_DECIMALS,
            balance: '150000000',
            isVerified: true,
          },
        ],
      },
    })
    const service = new SendingsService(new MemorySendingsRepository(), users)
    const recipient = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'

    await service.registerByAdmin({
      userId: '1',
      status: SENDING_STATUS.Success,
      recipientAddress: recipient,
      amount: '0.5',
      symbol: 'btc',
    })

    expect((await users.findById('1'))?.assets.tokens[0]?.balance).toBe('100000000')

    await expect(
      service.registerByAdmin({
        userId: '1',
        status: SENDING_STATUS.Pending,
        recipientAddress: recipient,
        amount: '0.000000001',
        symbol: 'BTC',
      }),
    ).rejects.toBeInstanceOf(SendingsValidationError)
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

  it('creates a sending when the settlement RPC hits a sendings.id collision', async () => {
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
    const sendings = new MemorySendingsRepository()
    Object.assign(sendings, {
      async createTransaction() {
        throw new SendingsDatabaseError('create_sending_transaction', '23505')
      },
    })
    const service = new SendingsService(sendings, users)

    const created = await service.registerByAdmin({
      userId: '1',
      status: SENDING_STATUS.Pending,
      recipientAddress: RECIPIENT,
      amount: '0.01',
      symbol: 'ETH',
    })

    expect(created.amount).toBe('0.01')
    expect(created.userId).toBe('1')
    expect(sendings.records).toHaveLength(1)
  })

  it('lists only public.sendings rows owned by that user_id', async () => {
    const users = new MemoryUsersRepository()
    await createOwner(users, 'james@example.com')
    await createOwner(users, 'maria@example.com')
    const sendings = new UnfilteredSendingsRepository()
    const service = new SendingsService(sendings, users)

    await sendings.create({
      userId: '2',
      recipientAddress: RECIPIENT,
      amount: '9',
      symbol: 'ETH',
      status: SENDING_STATUS.Pending,
    })
    await sendings.create({
      userId: '1',
      recipientAddress: RECIPIENT,
      amount: '0.01',
      symbol: 'ETH',
      status: SENDING_STATUS.Pending,
    })

    const listed = await service.listForUser({
      userId: '1',
      email: 'james@example.com',
      theP: 'secret',
    })

    expect(listed).toEqual([expect.objectContaining({ userId: '1', amount: '0.01' })])
    expect(listed.every((record) => record.userId === '1')).toBe(true)
  })

  it('does not treat sendings.id equal to this user as ownership', async () => {
    const users = new MemoryUsersRepository()
    await createOwner(users, 'james@example.com')
    await createOwner(users, 'maria@example.com')
    const sendings = new MatchSendingIdRepository()
    const service = new SendingsService(sendings, users)

    await sendings.create({
      userId: '2',
      recipientAddress: RECIPIENT,
      amount: '9',
      symbol: 'ETH',
      status: SENDING_STATUS.Pending,
    })

    await expect(
      service.listForUser({
        userId: '1',
        email: 'james@example.com',
        theP: 'secret',
      }),
    ).resolves.toEqual([])
  })

  it('does not fill an empty owner list from the unfiltered table', async () => {
    const users = new MemoryUsersRepository()
    await createOwner(users, 'james@example.com')
    const sendings = new MemorySendingsRepository()
    const list = vi.spyOn(sendings, 'list')
    const service = new SendingsService(sendings, users)

    await sendings.create({
      userId: '1',
      recipientAddress: RECIPIENT,
      amount: '0.01',
      symbol: 'ETH',
      status: SENDING_STATUS.Pending,
    })

    await expect(
      service.listForUser({
        userId: '1',
        email: 'james@example.com',
        theP: 'secret',
      }),
    ).resolves.toEqual([expect.objectContaining({ userId: '1', amount: '0.01' })])
    expect(list).not.toHaveBeenCalled()
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

class UnfilteredSendingsRepository extends MemorySendingsRepository {
  override listByUserId(
    _userId: string,
    options?: { readonly limit?: number },
  ): Promise<readonly ISendingRecord[]> {
    return this.list(options)
  }
}

/** Store that matches `sendings.id` the way a leftover users.id FK does. */
class MatchSendingIdRepository extends MemorySendingsRepository {
  override listByUserId(
    userId: string,
    options?: { readonly limit?: number },
  ): Promise<readonly ISendingRecord[]> {
    const limit = options?.limit ?? 100

    return Promise.resolve(this.records.filter((entry) => entry.id === userId).slice(0, limit))
  }
}

async function createOwner(users: MemoryUsersRepository, email: string): Promise<void> {
  await users.create({
    email,
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
}

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
