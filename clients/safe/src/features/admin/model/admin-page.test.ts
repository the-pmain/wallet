import { describe, expect, it } from 'vitest'

import {
  adminPageSearch,
  parseAdminDirectoryActivityRequest,
  parseAdminDirectorySending,
  parseAdminPage,
} from './admin-page'

describe('adminPageSearch', () => {
  it('omits an empty query', () => {
    expect(adminPageSearch({ page: 2, pageSize: 20, q: '  ' })).toBe('?page=2&pageSize=20')
  })

  it('includes a trimmed query', () => {
    expect(adminPageSearch({ page: 1, pageSize: 20, q: ' leo@ ' })).toBe(
      '?page=1&pageSize=20&q=leo%40',
    )
  })

  it('includes a pending status filter', () => {
    expect(adminPageSearch({ page: 1, pageSize: 100, q: '', status: 'pending' })).toBe(
      '?page=1&pageSize=100&status=pending',
    )
  })

  it('includes an approved status filter', () => {
    expect(adminPageSearch({ page: 1, pageSize: 20, q: '', status: 'approved' })).toBe(
      '?page=1&pageSize=20&status=approved',
    )
  })

  it('includes a requestedBy filter', () => {
    expect(adminPageSearch({ page: 1, pageSize: 20, q: '', requestedBy: ' Alex ' })).toBe(
      '?page=1&pageSize=20&requestedBy=Alex',
    )
  })

  it('includes a userId filter', () => {
    expect(adminPageSearch({ page: 1, pageSize: 20, q: '', userId: ' 101 ' })).toBe(
      '?page=1&pageSize=20&userId=101',
    )
  })
})

describe('parseAdminPage', () => {
  it('reads a sendings page with a joined email', () => {
    const page = parseAdminPage(
      {
        items: [
          {
            id: '62',
            createdAt: '2026-08-22T14:59:14.037Z',
            userId: '74',
            userEmail: 'leo@example.com',
            status: 'pending',
            failureMessage: null,
            recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
            amount: '4',
            symbol: 'ETH',
          },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
      },
      parseAdminDirectorySending,
    )

    expect(page).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 1,
    })
    expect(page?.items[0]?.userEmail).toBe('leo@example.com')
  })

  it('reads an activity-requests page with a joined email', () => {
    const page = parseAdminPage(
      {
        items: [
          {
            id: 'ar-1',
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
            recipientAddress: null,
            amount: '0.01',
            symbol: 'ETH',
            usdAmount: null,
          },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
      },
      parseAdminDirectoryActivityRequest,
    )

    expect(page?.items[0]).toMatchObject({
      id: 'ar-1',
      requestedByName: 'Alex',
      userEmail: 'james@example.com',
      kind: 'sending',
      requestStatus: 'pending',
    })
  })

  it('rejects a row without userEmail', () => {
    expect(
      parseAdminPage(
        {
          items: [
            {
              id: '62',
              createdAt: '2026-08-22T14:59:14.037Z',
              userId: '74',
              status: 'pending',
              failureMessage: null,
              recipientAddress: null,
              amount: '4',
              symbol: 'ETH',
            },
          ],
          page: 1,
          pageSize: 20,
          total: 1,
        },
        parseAdminDirectorySending,
      ),
    ).toBeNull()
  })
})
