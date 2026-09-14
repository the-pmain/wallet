import { describe, expect, it, vi } from 'vitest'

import { ServiceUnavailableError } from '../lib/errors.ts'

import {
  isBrokenSendingsIdFkError,
  isRecoverableSendingIdentityError,
  SendingsDatabaseError,
  SupabaseRestSendingsRepository,
} from './SupabaseRestSendingsRepository.ts'
import { SENDING_STATUS } from './status.ts'

const CREATED_ROW = {
  id: 72,
  created_at: '2026-08-22T13:19:59.797Z',
  user_id: '72',
  status: 'pending',
  failure_message: null,
  recipient_address: '0xBB010AAb37E5b891DD2246de894E86C323EaB66E',
  amount: '0.01',
  asset_symbol: 'ETH',
}

const FK_ERROR = {
  ok: false,
  status: 409,
  text: () =>
    Promise.resolve(
      JSON.stringify({
        code: '23503',
        details: 'Key (id)=(18) is not present in table "users".',
        message:
          'insert or update on table "sendings" violates foreign key constraint "sendings_id_fkey"',
      }),
    ),
}

describe('SupabaseRestSendingsRepository', () => {
  it('calls and parses the atomic create RPC', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            transaction: {
              ...CREATED_ROW,
              status: 'success',
              asset_chain_id: '1',
              asset_standard: 'native',
              asset_address: null,
              asset_name: 'Ether',
              asset_decimals: 18,
              asset_is_verified: true,
              settled_at: '2026-09-10T12:00:00.000Z',
            },
            assets: { quoteCurrency: 'USD', updatedAt: '2026-09-10T12:00:00.000Z', tokens: [] },
            assets_revision: 4,
          }),
        ),
    })
    const sendings = new SupabaseRestSendingsRepository({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const result = await sendings.createTransaction({
      userId: '72',
      status: SENDING_STATUS.Success,
      recipientAddress: CREATED_ROW.recipient_address,
      amount: '0.01',
      symbol: 'ETH',
      assetChainId: '1',
      assetStandard: 'native',
      assetAddress: null,
      assetName: 'Ether',
      assetDecimals: 18,
      assetIsVerified: true,
    })

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://example.supabase.co/rest/v1/rpc/create_sending_transaction',
    )
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      p_input: { user_id: '72', asset_chain_id: '1', asset_decimals: 18 },
    })
    expect(result.transaction.settledAt?.toISOString()).toBe('2026-09-10T12:00:00.000Z')
    expect(result.assetsRevision).toBe(4)
  })

  it('writes user_id, status, recipient_address and amount', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify([CREATED_ROW])),
    })
    const sendings = new SupabaseRestSendingsRepository({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const record = await sendings.create({
      userId: '72',
      status: SENDING_STATUS.Pending,
      recipientAddress: CREATED_ROW.recipient_address,
      amount: CREATED_ROW.amount,
      symbol: 'ETH',
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({
        apikey: 'service-role',
        authorization: 'Bearer service-role',
      }),
    })
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      user_id: '72',
      status: 'pending',
      failure_message: null,
      recipient_address: CREATED_ROW.recipient_address,
      amount: '0.01',
      asset_symbol: 'ETH',
    })
    expect(record).toMatchObject({
      id: '72',
      userId: '72',
      status: 'pending',
      amount: '0.01',
      symbol: 'ETH',
    })
  })

  it('retries with id = user_id when sendings_id_fkey rejects identity', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(FK_ERROR)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify([CREATED_ROW])),
      })
    const sendings = new SupabaseRestSendingsRepository({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const record = await sendings.create({
      userId: '72',
      status: SENDING_STATUS.Pending,
      recipientAddress: CREATED_ROW.recipient_address,
      amount: CREATED_ROW.amount,
      symbol: 'ETH',
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      user_id: '72',
      status: 'pending',
      failure_message: null,
      recipient_address: CREATED_ROW.recipient_address,
      amount: '0.01',
      asset_symbol: 'ETH',
    })
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      id: 72,
      user_id: '72',
    })
    expect(record.id).toBe('72')
    expect(record.userId).toBe('72')
  })

  it('uses an unused users.id when the preferred sending id is taken', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(FK_ERROR)
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              code: '23505',
              details: 'Key (id)=(72) already exists.',
              message: 'duplicate key value violates unique constraint "sendings_pkey"',
            }),
          ),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify([{ id: 72 }])),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify([{ id: 60 }, { id: 72 }])),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify([
              {
                ...CREATED_ROW,
                id: 60,
                user_id: '72',
              },
            ]),
          ),
      })
    const sendings = new SupabaseRestSendingsRepository({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const record = await sendings.create({
      userId: '72',
      status: SENDING_STATUS.Pending,
      recipientAddress: CREATED_ROW.recipient_address,
      amount: CREATED_ROW.amount,
      symbol: 'ETH',
    })

    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(JSON.parse(String(fetchMock.mock.calls[4]?.[1]?.body))).toMatchObject({
      id: 60,
      user_id: '72',
    })
    expect(record.id).toBe('60')
    expect(record.userId).toBe('72')
  })

  it('does not retry unrelated insert errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('{"message":"Invalid API key"}'),
    })
    const sendings = new SupabaseRestSendingsRepository({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const failure = sendings.create({
      userId: '72',
      status: SENDING_STATUS.Pending,
      recipientAddress: CREATED_ROW.recipient_address,
      amount: CREATED_ROW.amount,
      symbol: 'ETH',
    })

    await expect(failure).rejects.toBeInstanceOf(SendingsDatabaseError)
    await expect(failure).rejects.toBeInstanceOf(ServiceUnavailableError)
    await expect(failure).rejects.toMatchObject({
      message: 'Database is unavailable.',
      operation: 'create',
      isBrokenIdFk: false,
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('listByUserId keeps only rows whose user_id is the owner', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          JSON.stringify([
            {
              ...CREATED_ROW,
              id: 85,
              user_id: '100',
              amount: '9',
            },
            {
              ...CREATED_ROW,
              id: 12,
              user_id: '85',
              amount: '0.01',
            },
          ]),
        ),
    })
    const sendings = new SupabaseRestSendingsRepository({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const listed = await sendings.listByUserId('85')

    expect(listed).toEqual([expect.objectContaining({ id: '12', userId: '85', amount: '0.01' })])
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('user_id=eq.85')
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toMatch(/[?&]id=eq\./u)
  })

  it('treats sendings_pkey collisions as the broken id=user_id schema', () => {
    expect(
      isBrokenSendingsIdFkError(
        'Supabase responded with 409: {"code":"23505","details":"Key (id)=(70) already exists.","message":"duplicate key value violates unique constraint \\"sendings_pkey\\""}',
      ),
    ).toBe(true)
    expect(
      isBrokenSendingsIdFkError(
        'sendings_id_fkey requires sendings.id to be an unused users.id, and none are left.',
      ),
    ).toBe(true)
    expect(isBrokenSendingsIdFkError('{"message":"Invalid API key"}')).toBe(false)
    expect(
      isRecoverableSendingIdentityError(new SendingsDatabaseError('create_sending_transaction', '23505')),
    ).toBe(true)
    expect(isRecoverableSendingIdentityError(new SendingsDatabaseError('update', '42501'))).toBe(
      false,
    )
  })
})
