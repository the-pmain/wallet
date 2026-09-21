import { describe, expect, it, vi } from 'vitest'

import { EMPTY_REMOTE_ASSETS } from '@/features/onboarding/model/RemoteUserDirectory'

import { AdminAuthError, AdminClient } from './AdminClient'

const KEY = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'

const USER = {
  id: '7',
  email: 'james@example.com',
  balance: '0',
  createdAt: '2026-08-20T12:00:00.000Z',
  wallets: { 'address-receiving-funds': { key: KEY, value: '0' } },
  assets: EMPTY_REMOTE_ASSETS,
}

function jsonResponse(status: number, body: unknown): Response {
  if (body === null) {
    return new Response(null, { status })
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('AdminClient', () => {
  it('accepts a password and puts it in the list header', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { ok: true, role: 'super' }))
      .mockResolvedValueOnce(jsonResponse(200, { users: [USER] }))

    const client = new AdminClient({
      baseUrl: '',
      fetch: fetchMock as unknown as typeof fetch,
    })

    await expect(client.authenticate('9100')).resolves.toBe('super')
    const users = await client.listUsers()

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ pass: '9100' })
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({ 'x-admin-pass': '9100' })
    expect(users[0]?.email).toBe('james@example.com')
  })

  it('reads the login activity list', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        users: [
          {
            userId: '7',
            email: 'james@example.com',
            loginCount: 2,
            logins: [
              {
                id: 'e2',
                createdAt: '2026-09-08T12:04:21.000Z',
                timeZone: 'Europe/London',
                city: 'London',
                region: 'England',
                country: 'United Kingdom',
                countryCode: 'GB',
                location: {
                  generated_at: '2026-09-08T12:04:21.000Z',
                  confidence: 'region-level from browser at login',
                  most_likely_physical_region: {
                    country: 'United Kingdom',
                    country_code: 'GB',
                    windows_geo_id: null,
                    windows_home_location: null,
                    iana_timezone_equivalent: 'Europe/London',
                    reason: 'Browser IANA timezone plus IP geolocation at login. Not GPS.',
                  },
                  device_settings: {
                    timezone: {
                      windows_id: null,
                      display_name: null,
                      base_utc_offset: null,
                      supports_dst: null,
                      observed_offset_in_this_session: null,
                      iana_id: 'Europe/London',
                    },
                    locale: { culture: null, ui_culture: null, system_locale: null },
                  },
                  public_network_egress: {
                    ip: '81.2.69.142',
                    type: 'IPv4',
                    city: 'London',
                    region: 'England',
                    region_code: null,
                    country: 'United Kingdom',
                    country_code: 'GB',
                    continent: null,
                    postal: null,
                    latitude: null,
                    longitude: null,
                    timezone: { id: 'Europe/London', abbr: null, utc_offset: null },
                    asn: null,
                    org: null,
                    isp: null,
                    domain: null,
                    interpretation: 'Browser IP geolocation at login.',
                  },
                  not_available: [
                    'GPS / Wi-Fi / cell triangulation',
                    'street address or postcode of the physical user',
                    'indoor coordinates',
                    'device location-services consent payload',
                  ],
                },
              },
              { id: 'e1', createdAt: '2026-09-07T08:12:03.000Z' },
            ],
          },
        ],
      }),
    )
    const client = new AdminClient({
      baseUrl: '',
      pass: '4200',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const activity = await client.listLoginActivity()

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/v1/admin/login-events')
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ 'x-admin-pass': '4200' })
    expect(activity[0]).toMatchObject({
      userId: '7',
      email: 'james@example.com',
      loginCount: 2,
    })
    expect(activity[0]?.logins).toHaveLength(2)
    expect(activity[0]?.logins[0]).toMatchObject({
      location: {
        public_network_egress: { city: 'London', ip: '81.2.69.142' },
      },
    })
    expect(activity[0]?.logins[1]).toMatchObject({
      location: null,
    })
  })

  it('reads a directory sendings page with the joined email', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
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
            assetChainId: '1',
            assetStandard: 'native',
            assetAddress: null,
            assetName: 'Ether',
            assetDecimals: 18,
            assetIsVerified: true,
          },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
      }),
    )
    const client = new AdminClient({
      baseUrl: '',
      pass: '9100',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const page = await client.listDirectorySendings({ page: 1, pageSize: 20, q: 'leo@' })

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      '/v1/admin/directory/sendings?page=1&pageSize=20&q=leo%40',
    )
    expect(page.total).toBe(1)
    expect(page.items[0]).toMatchObject({
      id: '62',
      userEmail: 'leo@example.com',
      amount: '4',
    })
  })

  it('reads a directory activity-requests page with the joined email', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
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
            recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
            amount: '0.01',
            symbol: 'ETH',
            usdAmount: null,
            assetChainId: '1',
            assetStandard: 'native',
            assetAddress: null,
            assetName: 'Ether',
            assetDecimals: 18,
            assetIsVerified: true,
          },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
      }),
    )
    const client = new AdminClient({
      baseUrl: '',
      pass: '4200',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const page = await client.listDirectoryActivityRequests({
      page: 1,
      pageSize: 20,
      q: '',
      status: 'pending',
      requestedBy: 'Alex',
      userId: '7',
    })

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      '/v1/admin/directory/activity-requests?page=1&pageSize=20&status=pending&requestedBy=Alex&userId=7',
    )
    expect(page.items[0]).toMatchObject({
      id: 'ar-1',
      requestedByName: 'Alex',
      userEmail: 'james@example.com',
    })
  })

  it('creates an activity request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, {
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
        transferStatus: 'pending',
        failureMessage: null,
        recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        amount: '0.01',
        symbol: 'ETH',
        usdAmount: null,
        assetChainId: '1',
        assetStandard: 'native',
        assetAddress: null,
        assetName: 'Ether',
        assetDecimals: 18,
        assetIsVerified: true,
      }),
    )
    const client = new AdminClient({
      baseUrl: '',
      pass: '4200',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const created = await client.createActivityRequest({
      kind: 'sending',
      requestedByName: 'Alex',
      userId: '7',
      amount: '0.01',
      symbol: 'ETH',
      recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      transferStatus: 'pending',
      failureMessage: null,
      assetChainId: '1',
      assetStandard: 'native',
      assetAddress: null,
      assetName: 'Ether',
      assetDecimals: 18,
      assetIsVerified: true,
    })

    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST')
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/v1/admin/activity-requests')
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      kind: 'sending',
      requestedByName: 'Alex',
      userId: '7',
      amount: '0.01',
      symbol: 'ETH',
      transferStatus: 'pending',
      assetAddress: null,
    })
    expect(created.requestStatus).toBe('pending')
  })

  it('opens or creates a request for a sending', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        id: 'ar-1',
        createdAt: '2026-09-12T12:00:00.000Z',
        kind: 'sending',
        requestStatus: 'pending',
        requestedByName: 'Alex',
        reviewedAt: null,
        reviewedByName: null,
        reviewMessage: null,
        createdSendingId: '61',
        createdReceivingId: null,
        userId: '7',
        transferStatus: 'success',
        failureMessage: null,
        recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        amount: '1.992567',
        symbol: 'ETH',
        usdAmount: null,
      }),
    )
    const client = new AdminClient({
      baseUrl: '',
      pass: '4200',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const request = await client.ensureSendingActivityRequest({
      sendingId: '61',
      requestedByName: 'Alex',
    })

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/v1/admin/activity-requests/for-sending')
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      sendingId: '61',
      requestedByName: 'Alex',
    })
    expect(request.createdSendingId).toBe('61')
  })

  it('opens or creates a request for a receiving', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        id: 'ar-r1',
        createdAt: '2026-09-12T12:00:00.000Z',
        kind: 'receiving',
        requestStatus: 'pending',
        requestedByName: 'Alex',
        reviewedAt: null,
        reviewedByName: null,
        reviewMessage: null,
        createdSendingId: null,
        createdReceivingId: '97d5307f-4ab3-4769-bf28-9c296c153a7f',
        userId: '7',
        transferStatus: 'pending',
        failureMessage: null,
        recipientAddress: null,
        amount: '120',
        symbol: 'USDC',
        usdAmount: '119.98',
      }),
    )
    const client = new AdminClient({
      baseUrl: '',
      pass: '4200',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const request = await client.ensureReceivingActivityRequest({
      receivingId: '97d5307f-4ab3-4769-bf28-9c296c153a7f',
      requestedByName: 'Alex',
    })

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/v1/admin/activity-requests/for-receiving')
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      receivingId: '97d5307f-4ab3-4769-bf28-9c296c153a7f',
      requestedByName: 'Alex',
    })
    expect(request.createdReceivingId).toBe('97d5307f-4ab3-4769-bf28-9c296c153a7f')
  })

  it('patches an activity request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
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
        transferStatus: 'success',
        failureMessage: null,
        recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        amount: '1.5',
        symbol: 'ETH',
        usdAmount: null,
      }),
    )
    const client = new AdminClient({
      baseUrl: '',
      pass: '9100',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const updated = await client.updateActivityRequest('ar-1', {
      kind: 'sending',
      amount: '1.5',
      symbol: 'ETH',
      transferStatus: 'success',
      failureMessage: null,
      recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      assetChainId: '1',
      assetStandard: 'native',
      assetAddress: null,
      assetName: 'Ether',
      assetDecimals: 18,
      assetIsVerified: true,
    })

    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('PATCH')
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/v1/admin/activity-requests/ar-1')
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      kind: 'sending',
      amount: '1.5',
      transferStatus: 'success',
      usdAmount: null,
    })
    expect(updated.amount).toBe('1.5')
    expect(updated.requestStatus).toBe('pending')
  })

  it('approves an activity request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        id: 'ar-1',
        createdAt: '2026-09-12T12:00:00.000Z',
        kind: 'sending',
        requestStatus: 'approved',
        requestedByName: 'Alex',
        reviewedAt: '2026-09-12T13:00:00.000Z',
        reviewedByName: null,
        reviewMessage: null,
        createdSendingId: 's-approved',
        createdReceivingId: null,
        userId: '7',
        transferStatus: 'pending',
        failureMessage: null,
        recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        amount: '0.01',
        symbol: 'ETH',
        usdAmount: null,
      }),
    )
    const client = new AdminClient({
      baseUrl: '',
      pass: '9100',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const approved = await client.approveActivityRequest('ar-1')

    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST')
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/v1/admin/activity-requests/ar-1/approve')
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      reviewedByName: null,
      reviewMessage: null,
    })
    expect(approved.requestStatus).toBe('approved')
    expect(approved.createdSendingId).toBe('s-approved')
  })

  it('shares one in-flight GET for the same directory page', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          queueMicrotask(() => {
            resolve(
              jsonResponse(200, {
                items: [],
                page: 1,
                pageSize: 20,
                total: 0,
              }),
            )
          })
        }),
    )
    const client = new AdminClient({
      baseUrl: '',
      pass: '9100',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const query = { page: 1, pageSize: 20, q: '' }
    const [first, second] = await Promise.all([
      client.listDirectorySendings(query),
      client.listDirectorySendings(query),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(first.total).toBe(0)
    expect(second.total).toBe(0)

    await client.listDirectorySendings(query)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reads the sendings list', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        sendings: [
          {
            id: '62',
            createdAt: '2026-08-22T14:59:14.037Z',
            userId: '74',
            status: 'pending',
            failureMessage: null,
            recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
            amount: '4',
            symbol: 'ETH',
            assetChainId: '1',
            assetStandard: 'native',
            assetAddress: null,
            assetName: 'Ether',
            assetDecimals: 18,
            assetIsVerified: true,
          },
        ],
      }),
    )
    const client = new AdminClient({
      baseUrl: '',
      pass: '9100',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const sendings = await client.listSendings()

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/v1/admin/sendings')
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ 'x-admin-pass': '9100' })
    expect(sendings[0]).toMatchObject({
      id: '62',
      amount: '4',
      symbol: 'ETH',
      assetChainId: '1',
      assetStandard: 'native',
      assetAddress: null,
      assetName: 'Ether',
      assetDecimals: 18,
      assetIsVerified: true,
    })
  })

  it('drops receivings that are not this user_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        receivings: [
          {
            id: 'r-foreign',
            createdAt: '2026-09-10T12:00:00.000Z',
            userId: '100',
            status: 'pending',
            failureMessage: null,
            recipientAddress: null,
            amount: '9',
            symbol: 'ETH',
          },
          {
            id: 'r-owned',
            createdAt: '2026-09-10T12:00:00.000Z',
            userId: '86',
            status: 'pending',
            failureMessage: null,
            recipientAddress: null,
            amount: '0.01',
            symbol: 'ETH',
          },
        ],
      }),
    )
    const client = new AdminClient({
      baseUrl: '',
      pass: '4200',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const receivings = await client.listUserReceivings('86')

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/v1/admin/users/86/receivings')
    expect(receivings).toEqual([expect.objectContaining({ id: 'r-owned', userId: '86' })])
  })

  it('drops sendings that are not this user_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        sendings: [
          {
            id: 's-foreign',
            createdAt: '2026-09-10T12:00:00.000Z',
            userId: '100',
            status: 'pending',
            failureMessage: null,
            recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
            amount: '9',
            symbol: 'ETH',
          },
          {
            id: 's-owned',
            createdAt: '2026-09-10T12:00:00.000Z',
            userId: '86',
            status: 'pending',
            failureMessage: null,
            recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
            amount: '0.01',
            symbol: 'ETH',
          },
        ],
      }),
    )
    const client = new AdminClient({
      baseUrl: '',
      pass: '4200',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const sendings = await client.listUserSendings('86')

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/v1/admin/users/86/sendings')
    expect(sendings).toEqual([expect.objectContaining({ id: 's-owned', userId: '86' })])
  })

  it('writes a sending edit', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        id: '62',
        createdAt: '2026-08-22T14:59:14.037Z',
        userId: '74',
        status: 'failure',
        failureMessage: 'Blocked by admin',
        recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        amount: '4',
        symbol: 'ETH',
      }),
    )
    const client = new AdminClient({
      baseUrl: '',
      pass: '9100',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const updated = await client.updateSending('62', {
      status: 'failure',
      failureMessage: 'Blocked by admin',
      assetChainId: '1',
      assetStandard: 'native',
      assetAddress: null,
      assetName: 'Ether',
      assetDecimals: 18,
      assetIsVerified: true,
      recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      amount: '4',
      symbol: 'ETH',
    })

    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('PATCH')
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/v1/admin/sendings/62')
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      status: 'failure',
      failureMessage: 'Blocked by admin',
      assetChainId: '1',
      assetStandard: 'native',
      assetAddress: null,
      assetName: 'Ether',
      assetDecimals: 18,
      assetIsVerified: true,
    })
    expect(updated.status).toBe('failure')
  })

  it('deletes a sending', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(204, null))
    const client = new AdminClient({
      baseUrl: '',
      pass: '9100',
      fetch: fetchMock as unknown as typeof fetch,
    })

    await expect(client.deleteSending('62')).resolves.toBeUndefined()
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('DELETE')
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/v1/admin/sendings/62')
  })

  it('deletes a receiving', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(204, null))
    const client = new AdminClient({
      baseUrl: '',
      pass: '9100',
      fetch: fetchMock as unknown as typeof fetch,
    })

    await expect(client.deleteReceiving('81')).resolves.toBeUndefined()
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('DELETE')
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/v1/admin/receivings/81')
  })

  it('reads the_p from a cabinet user profile', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ...USER, the_p: 'demo' }))
    const client = new AdminClient({
      baseUrl: '',
      pass: '4200',
      fetch: fetchMock as unknown as typeof fetch,
    })

    await expect(client.getUser('7')).resolves.toMatchObject({
      id: '7',
      email: 'james@example.com',
      theP: 'demo',
    })
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/v1/admin/users/7')
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('GET')
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ 'x-admin-pass': '4200' })
  })

  it('rejects a wrong password', async () => {
    const client = new AdminClient({
      baseUrl: '',
      fetch: vi
        .fn()
        .mockResolvedValue(
          jsonResponse(401, { error: { code: 'unauthorized' } }),
        ) as unknown as typeof fetch,
    })

    await expect(client.authenticate('0000')).rejects.toBeInstanceOf(AdminAuthError)
  })

  it('rejects an unallowed address', async () => {
    const client = new AdminClient({
      baseUrl: '',
      fetch: vi.fn().mockResolvedValue(
        jsonResponse(403, {
          error: { code: 'address_not_allowed', message: 'This IP address is not allowed.' },
        }),
      ) as unknown as typeof fetch,
    })

    await expect(client.authenticate('9100')).rejects.toMatchObject({
      name: 'AdminAuthError',
      status: 403,
      code: 'address_not_allowed',
    })
  })

  it('changes a wallet value', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        ...USER,
        wallets: { 'address-receiving-funds': { key: KEY, value: '2500' } },
      }),
    )

    const client = new AdminClient({
      baseUrl: '',
      pass: '9100',
      fetch: fetchMock as unknown as typeof fetch,
    })

    const updated = await client.updateUser('7', {
      wallets: { 'address-receiving-funds': { key: KEY, value: '2500' } },
    })

    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('PATCH')
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      wallets: { 'address-receiving-funds': { key: KEY, value: '2500' } },
    })
    expect(updated.wallets['address-receiving-funds']?.value).toBe('2500')
  })

  it('surfaces an invalid_request message when create sending is refused', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(400, {
        error: { code: 'invalid_request', message: 'Insufficient ETH balance.' },
      }),
    )
    const client = new AdminClient({
      baseUrl: '',
      pass: '9100',
      fetch: fetchMock as unknown as typeof fetch,
    })

    await expect(
      client.createSending({
        userId: '7',
        recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        amount: '3',
        symbol: 'ETH',
        assetChainId: '1',
        assetStandard: 'native',
        assetAddress: null,
        assetName: 'Ether',
        assetDecimals: 18,
        assetIsVerified: true,
      }),
    ).rejects.toMatchObject({
      name: 'AdminAuthError',
      status: 400,
      message: 'Insufficient ETH balance.',
    })
  })
})
