import { describe, expect, it, vi } from 'vitest'

import { SENDING_STATUS } from '../sendings/status.ts'
import { SupabaseRestReceivingsRepository } from './SupabaseRestReceivingsRepository.ts'

describe('SupabaseRestReceivingsRepository', () => {
  it('calls and parses the atomic receiving RPC', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            transaction: {
              id: 'f3b50a1e-e54e-49f5-9ca0-c919e078c870',
              created_at: '2026-09-10T12:00:00.000Z',
              user_id: '1',
              status: 'success',
              failure_message: null,
              recipient_address: null,
              amount: '1.25',
              asset_symbol: 'USDC',
              usd_amount: '1.25',
              asset_chain_id: '1',
              asset_standard: 'ERC-20',
              asset_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              asset_name: 'USD Coin',
              asset_decimals: 6,
              asset_is_verified: true,
              settled_at: '2026-09-10T12:00:00.000Z',
            },
            assets: { quoteCurrency: 'USD', updatedAt: '2026-09-10T12:00:00.000Z', tokens: [] },
            assets_revision: 2,
          }),
        ),
    })
    const repository = new SupabaseRestReceivingsRepository({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const result = await repository.createTransaction({
      userId: '1',
      status: SENDING_STATUS.Success,
      amount: '1.25',
      symbol: 'USDC',
      usdAmount: '1.25',
      assetChainId: '1',
      assetStandard: 'ERC-20',
      assetAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      assetName: 'USD Coin',
      assetDecimals: 6,
      assetIsVerified: true,
    })

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://example.supabase.co/rest/v1/rpc/create_receiving_transaction',
    )
    expect(result.transaction.assetDecimals).toBe(6)
    expect(result.assetsRevision).toBe(2)
  })
})
