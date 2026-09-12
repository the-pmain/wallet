import { describe, expect, it, vi } from 'vitest'

import { SENDING_STATUS } from '../sendings/status.ts'

import { ACTIVITY_REQUEST_KIND } from './kind.ts'
import { ACTIVITY_REQUEST_STATUS } from './request-status.ts'
import { SupabaseRestActivityRequestsRepository } from './SupabaseRestActivityRequestsRepository.ts'

const ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  created_at: '2026-09-12T12:00:00.000Z',
  kind: 'sending',
  request_status: 'pending',
  requested_by_name: 'Alex',
  reviewed_at: null,
  reviewed_by_name: null,
  review_message: null,
  created_sending_id: null,
  created_receiving_id: null,
  user_id: '7',
  transfer_status: 'pending',
  failure_message: null,
  recipient_address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  amount: '0.01',
  asset_symbol: 'ETH',
  usd_amount: null,
}

describe('SupabaseRestActivityRequestsRepository', () => {
  it('writes snake_case columns on create', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify([ROW])),
    })
    const store = new SupabaseRestActivityRequestsRepository({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const record = await store.create({
      kind: ACTIVITY_REQUEST_KIND.Sending,
      requestedByName: 'Alex',
      userId: '7',
      transferStatus: SENDING_STATUS.Pending,
      failureMessage: null,
      recipientAddress: ROW.recipient_address,
      amount: '0.01',
      symbol: 'ETH',
      usdAmount: null,
    })

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://example.supabase.co/rest/v1/activity_requests',
    )
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      kind: 'sending',
      requested_by_name: 'Alex',
      user_id: '7',
      transfer_status: 'pending',
      failure_message: null,
      recipient_address: ROW.recipient_address,
      amount: '0.01',
      asset_symbol: 'ETH',
      usd_amount: null,
    })
    expect(record).toMatchObject({
      id: ROW.id,
      kind: 'sending',
      requestStatus: 'pending',
      requestedByName: 'Alex',
      symbol: 'ETH',
    })
  })

  it('patches only while the row is still pending', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify([
            {
              ...ROW,
              request_status: 'rejected',
              reviewed_at: '2026-09-12T13:00:00.000Z',
              review_message: 'No',
            },
          ]),
        ),
    })
    const store = new SupabaseRestActivityRequestsRepository({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const record = await store.reviewIfPending(ROW.id, {
      requestStatus: ACTIVITY_REQUEST_STATUS.Rejected,
      reviewedAt: new Date('2026-09-12T13:00:00.000Z'),
      reviewedByName: null,
      reviewMessage: 'No',
      createdSendingId: null,
      createdReceivingId: null,
    })

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('request_status=eq.pending')
    expect(record?.requestStatus).toBe('rejected')
  })

  it('patches draft columns only while the row is still pending', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify([
            {
              ...ROW,
              amount: '2',
              transfer_status: 'success',
            },
          ]),
        ),
    })
    const store = new SupabaseRestActivityRequestsRepository({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const record = await store.updateIfPending(ROW.id, {
      kind: ACTIVITY_REQUEST_KIND.Sending,
      transferStatus: SENDING_STATUS.Success,
      failureMessage: null,
      recipientAddress: ROW.recipient_address,
      amount: '2',
      symbol: 'ETH',
      usdAmount: null,
    })

    expect(decodeURIComponent(String(fetchMock.mock.calls[0]?.[0]))).toContain(
      'request_status=in.(pending,approved)',
    )
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      kind: 'sending',
      request_status: 'pending',
      reviewed_at: null,
      reviewed_by_name: null,
      review_message: null,
      transfer_status: 'success',
      failure_message: null,
      recipient_address: ROW.recipient_address,
      amount: '2',
      asset_symbol: 'ETH',
      usd_amount: null,
    })
    expect(record?.amount).toBe('2')
    expect(record?.transferStatus).toBe('success')
  })
})
