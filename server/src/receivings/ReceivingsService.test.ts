import { describe, expect, it, vi } from 'vitest'

import { SENDING_STATUS } from '../sendings/status.ts'
import { ASSET_STANDARD } from '../users/assets.ts'
import {
  BITCOIN_DECIMALS,
  BITCOIN_LEDGER_CHAIN_ID,
  BITCOIN_NAME,
  BITCOIN_SYMBOL,
} from '../users/ledger-assets.ts'
import { MemoryUsersRepository } from '../users/MemoryUsersRepository.ts'

import type { IReceivingRecord } from './contracts.ts'
import { MemoryReceivingsRepository } from './MemoryReceivingsRepository.ts'
import { ReceivingsService } from './ReceivingsService.ts'

describe('ReceivingsService', () => {
  it('creates a pending receiving without changing the holding', async () => {
    const { service, users } = await setup()

    const record = await service.register({
      userId: '1',
      status: SENDING_STATUS.Pending,
      amount: '3',
      symbol: 'ETH',
      usdAmount: '9852.36',
    })

    expect(record.status).toBe(SENDING_STATUS.Pending)
    expect(record.amount).toBe('3')
    expect(record.usdAmount).toBe('9852.36')

    const user = await users.findById('1')
    expect(user?.assets.tokens[0]?.balance).toBe('2000000000000000000')
  })

  it('credits the holding additively when the receiving succeeds', async () => {
    const { service, users } = await setup()

    await service.register({
      userId: '1',
      status: SENDING_STATUS.Success,
      amount: '3',
      symbol: 'ETH',
    })

    const user = await users.findById('1')
    expect(user?.assets.tokens[0]?.balance).toBe('5000000000000000000')
  })

  it('appends canonical bitcoin and credits satoshis', async () => {
    const { service, users } = await setup()

    const record = await service.register({
      userId: '1',
      status: SENDING_STATUS.Success,
      amount: '0.25',
      symbol: 'btc',
      assetChainId: BITCOIN_LEDGER_CHAIN_ID,
      assetStandard: ASSET_STANDARD.Native,
      assetAddress: null,
      assetName: BITCOIN_NAME,
      assetDecimals: BITCOIN_DECIMALS,
      assetIsVerified: true,
    })

    expect(record.symbol).toBe(BITCOIN_SYMBOL)
    expect(record.assetDecimals).toBe(BITCOIN_DECIMALS)

    const user = await users.findById('1')
    expect(user?.assets.tokens[1]).toEqual({
      chainId: BITCOIN_LEDGER_CHAIN_ID,
      standard: ASSET_STANDARD.Native,
      address: null,
      symbol: BITCOIN_SYMBOL,
      name: BITCOIN_NAME,
      decimals: BITCOIN_DECIMALS,
      balance: '25000000',
      isVerified: true,
    })
  })

  it('appends an unknown successful asset when metadata is supplied', async () => {
    const { service, users } = await setup()

    const record = await service.register({
      userId: '1',
      status: SENDING_STATUS.Success,
      amount: '12',
      symbol: 'SOL',
      assetChainId: '101',
      assetStandard: ASSET_STANDARD.Native,
      assetAddress: null,
      assetName: 'Solana',
      assetDecimals: 9,
      assetIsVerified: false,
    })

    expect(record.symbol).toBe('SOL')
    expect(record.status).toBe(SENDING_STATUS.Success)

    const user = await users.findById('1')
    expect(user?.assets.tokens[1]).toMatchObject({
      chainId: '101',
      symbol: 'SOL',
      balance: '12000000000',
    })
  })

  it('applies the holding when a pending receiving is marked success', async () => {
    const { service, users } = await setup()

    const created = await service.register({
      userId: '1',
      status: SENDING_STATUS.Pending,
      amount: '1.5',
      symbol: 'ETH',
    })

    await service.update(created.id, {
      status: SENDING_STATUS.Success,
      failureMessage: null,
      amount: '1.5',
      symbol: 'ETH',
    })

    const user = await users.findById('1')
    expect(user?.assets.tokens[0]?.balance).toBe('3500000000000000000')
  })

  it('reverses success to failure and retains the zero-balance entity', async () => {
    const { service, users } = await setup()
    const created = await service.register({
      userId: '1',
      status: SENDING_STATUS.Success,
      amount: '2',
      symbol: 'NEW',
      assetChainId: '1',
      assetStandard: ASSET_STANDARD.Erc20,
      assetAddress: '0x0000000000000000000000000000000000000001',
      assetName: 'New Token',
      assetDecimals: 6,
      assetIsVerified: false,
    })

    await service.update(created.id, {
      status: SENDING_STATUS.Failure,
      failureMessage: 'rejected',
      amount: '2',
      symbol: 'NEW',
      assetChainId: '1',
      assetStandard: ASSET_STANDARD.Erc20,
      assetAddress: '0x0000000000000000000000000000000000000001',
      assetName: 'New Token',
      assetDecimals: 6,
      assetIsVerified: false,
    })

    expect((await users.findById('1'))?.assets.tokens[1]?.balance).toBe('0')
  })

  it('reconciles successful amount edits and repeated updates', async () => {
    const { service, users } = await setup()
    const created = await service.register({
      userId: '1',
      status: SENDING_STATUS.Success,
      amount: '1',
      symbol: 'ETH',
    })
    const patch = {
      status: SENDING_STATUS.Success,
      failureMessage: null,
      amount: '2',
      symbol: 'ETH',
    } as const

    await service.update(created.id, patch)
    await service.update(created.id, patch)

    expect((await users.findById('1'))?.assets.tokens[0]?.balance).toBe('4000000000000000000')
  })

  it('deletes a pending receiving without changing the holding', async () => {
    const { service, users } = await setup()
    const created = await service.register({
      userId: '1',
      status: SENDING_STATUS.Pending,
      amount: '1.5',
      symbol: 'ETH',
    })

    await expect(service.remove(created.id)).resolves.toMatchObject({ id: created.id })
    await expect(service.remove(created.id)).resolves.toBeNull()
    expect((await users.findById('1'))?.assets.tokens[0]?.balance).toBe('2000000000000000000')
  })

  it('lists only public.receivings rows owned by that user_id', async () => {
    const users = new MemoryUsersRepository()
    const receivings = new UnfilteredReceivingsRepository()
    await seedUser(users, 'james@example.com')
    await seedUser(users, 'maria@example.com')
    const service = new ReceivingsService(receivings, users)

    await receivings.create({
      userId: '2',
      amount: '9',
      symbol: 'ETH',
      status: SENDING_STATUS.Pending,
    })
    await receivings.create({
      userId: '1',
      amount: '3',
      symbol: 'ETH',
      status: SENDING_STATUS.Pending,
    })

    const listed = await service.listForUser({
      userId: '1',
      email: 'james@example.com',
      theP: 'secret',
    })

    expect(listed).toEqual([expect.objectContaining({ userId: '1', amount: '3' })])
    expect(listed.every((record) => record.userId === '1')).toBe(true)
    expect(listed.some((record) => record.userId === '2')).toBe(false)
  })

  it('does not fill an empty owner list from the unfiltered table', async () => {
    const users = new MemoryUsersRepository()
    const receivings = new MemoryReceivingsRepository()
    const list = vi.spyOn(receivings, 'list')
    await seedUser(users, 'james@example.com')
    const service = new ReceivingsService(receivings, users)

    await receivings.create({
      userId: '1',
      amount: '3',
      symbol: 'ETH',
      status: SENDING_STATUS.Pending,
    })

    await expect(
      service.listForUser({
        userId: '1',
        email: 'james@example.com',
        theP: 'secret',
      }),
    ).resolves.toEqual([expect.objectContaining({ userId: '1', amount: '3' })])
    expect(list).not.toHaveBeenCalled()
  })

  it('debits the holding when a successful receiving is deleted', async () => {
    const { service, users } = await setup()
    const created = await service.register({
      userId: '1',
      status: SENDING_STATUS.Success,
      amount: '1',
      symbol: 'ETH',
    })
    expect((await users.findById('1'))?.assets.tokens[0]?.balance).toBe('3000000000000000000')

    await expect(service.remove(created.id)).resolves.toMatchObject({ id: created.id })
    expect((await users.findById('1'))?.assets.tokens[0]?.balance).toBe('2000000000000000000')
  })
})

class UnfilteredReceivingsRepository extends MemoryReceivingsRepository {
  override listByUserId(
    _userId: string,
    options?: { readonly limit?: number },
  ): Promise<readonly IReceivingRecord[]> {
    return this.list(options)
  }
}

async function seedUser(users: MemoryUsersRepository, email: string): Promise<void> {
  await users.create({
    email,
    balance: '0',
    theP: 'secret',
    assets: {
      quoteCurrency: 'USD',
      updatedAt: '2026-08-20T12:00:00.000Z',
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
  const receivings = new MemoryReceivingsRepository()

  await users.create({
    email: 'james@example.com',
    balance: '0',
    theP: 'secret',
    assets: {
      quoteCurrency: 'USD',
      updatedAt: '2026-08-20T12:00:00.000Z',
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

  return { service: new ReceivingsService(receivings, users), users }
}
