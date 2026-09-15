import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import { appMarketCatalog, parseMarketList } from '@/core'
import { EMPTY_REMOTE_ASSETS } from '@/features/onboarding/model/RemoteUserDirectory'
import { createTestAppServices, TestEventSource, type ITestAppServices } from '@/test/doubles'
import { openPath } from '@/test/open-path'

import { AppProviders } from '@/app/providers'
import { AppRouter } from '@/app/router'

import {
  ADMIN_NAME_STORAGE_KEY,
  ADMIN_PIN_STORAGE_KEY,
  ADMIN_PINNED_USERS_STORAGE_KEY,
} from '@/features/admin'
import { activityMatchesAdminQuery } from '@/features/admin/model/activity-query'
import { userMatchesAdminQuery } from '@/features/admin/model/admin-query'
import { sendingMatchesAdminQuery } from '@/features/admin/model/sending-query'
import { shortenAddress } from '@/features/wallet'

const RECIPIENT = '0x6B175474E89094C44Da98b954EedeAC495271d0F'

const KEY = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'

const ETH_TOKEN = {
  chainId: '1',
  standard: 'native' as const,
  address: null,
  symbol: 'ETH',
  name: 'Ether',
  decimals: 18,
  balance: '2000000000000000000',
  isVerified: true,
}

const USDC_TOKEN = {
  chainId: '1',
  standard: 'ERC-20' as const,
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  balance: '0',
  isVerified: true,
}

const USER = {
  id: '7',
  email: 'james@example.com',
  the_p: 'demo',
  balance: '12.5',
  createdAt: '2026-08-20T12:00:00.000Z',
  wallets: [{ key: KEY, value: '0' }],
  assets: {
    quoteCurrency: 'USD' as const,
    updatedAt: '2026-08-20T12:00:00.000Z',
    tokens: [ETH_TOKEN, USDC_TOKEN],
  },
}

const MARIA = {
  id: '8',
  email: 'maria@example.com',
  balance: '0',
  createdAt: '2026-08-20T12:00:00.000Z',
  wallets: [],
  assets: EMPTY_REMOTE_ASSETS,
}

const LEO = {
  id: '74',
  email: 'leo@example.com',
  balance: '0',
  createdAt: '2026-08-20T12:00:00.000Z',
  wallets: [],
  assets: EMPTY_REMOTE_ASSETS,
}

const EMPTY_LOGIN_PLACE = {
  location: null,
}

const REGISTERED_LOGIN_LOCATION = {
  generated_at: '2026-09-08T12:04:21.000Z',
  confidence:
    'region-level from browser at login; IANA timezone from Intl; city/region/country from IP geolocation; not GPS; IP may be VPN/datacenter',
  most_likely_physical_region: {
    country: 'United Kingdom',
    country_code: 'GB',
    windows_geo_id: 242,
    windows_home_location: 'United Kingdom',
    iana_timezone_equivalent: 'Europe/London',
    reason:
      'Windows home location is United Kingdom; timezone is GMT Standard Time (London); session offset is UTC+01:00, which matches BST on 8 Sep.',
  },
  device_settings: {
    timezone: {
      windows_id: 'GMT Standard Time',
      display_name: '(UTC+00:00) Dublin, Edinburgh, Lisbon, London',
      base_utc_offset: '+00:00',
      supports_dst: true,
      observed_offset_in_this_session: '+01:00',
      iana_id: 'Europe/London',
    },
    locale: {
      culture: 'en-US',
      ui_culture: 'en-US',
      system_locale: 'en-US',
    },
  },
  public_network_egress: {
    ip: '81.2.69.142',
    type: 'IPv4',
    city: 'London',
    region: 'England',
    region_code: 'ENG',
    country: 'United Kingdom',
    country_code: 'GB',
    continent: 'Europe',
    postal: null,
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: { id: 'Europe/London', abbr: 'BST', utc_offset: '+01:00' },
    asn: 2856,
    org: 'BT',
    isp: 'BT',
    domain: null,
    interpretation:
      'Browser IP geolocation at login. May be VPN/datacenter egress, not the physical home address.',
  },
  not_available: [
    'GPS / Wi-Fi / cell triangulation',
    'street address or postcode of the physical user',
    'indoor coordinates',
    'device location-services consent payload',
  ],
}

const LOGIN_ACTIVITY = {
  users: [
    {
      userId: '7',
      email: 'james@example.com',
      loginCount: 2,
      logins: [
        {
          id: 'e2',
          createdAt: '2026-09-08T12:04:21.000Z',
          location: REGISTERED_LOGIN_LOCATION,
        },
        { id: 'e1', createdAt: '2026-09-07T08:12:03.000Z', ...EMPTY_LOGIN_PLACE },
      ],
    },
    {
      userId: '8',
      email: 'maria@example.com',
      loginCount: 0,
      logins: [],
    },
  ],
}

let services: ITestAppServices
let fetchSpy: MockInstance<typeof fetch>
let listedSendings: unknown[]
let listedReceivings: unknown[]
let listedActivityRequests: unknown[]
let forSendingDelayMs: number

const PENDING_SENDING = {
  id: '61',
  createdAt: '2026-08-22T14:44:10.949Z',
  userId: '74',
  status: 'pending',
  failureMessage: null,
  recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  amount: '2',
  symbol: 'ETH',
} as const

const PENDING_ACTIVITY_REQUEST = {
  id: 'ar-pending',
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
  recipientAddress: '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
  amount: '0.01',
  symbol: 'ETH',
  usdAmount: null,
  assetChainId: '1',
  assetStandard: 'native',
  assetAddress: null,
  assetName: 'Ether',
  assetDecimals: 18,
  assetIsVerified: true,
} as const

function activityRequestFrame(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const userId = String(overrides['userId'] ?? PENDING_ACTIVITY_REQUEST.userId)

  return {
    ...PENDING_ACTIVITY_REQUEST,
    userEmail: DIRECTORY_EMAILS[userId] ?? null,
    type_request: 'create',
    ...overrides,
  }
}

async function openedActivityRequestStream() {
  await waitFor(() => {
    expect(
      TestEventSource.instances.some((item) =>
        item.url.includes('/v1/admin/activity-requests/stream'),
      ),
    ).toBe(true)
  })

  const source = TestEventSource.instances.find((item) =>
    item.url.includes('/v1/admin/activity-requests/stream'),
  )

  expect(source).toBeDefined()

  return source as (typeof TestEventSource.instances)[number]
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

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }

  if (input instanceof URL) {
    return input.href
  }

  return input.url
}

function requestJson(init?: RequestInit): unknown {
  const raw = init?.body

  if (typeof raw !== 'string') {
    return null
  }

  return JSON.parse(raw) as unknown
}

function requestPath(url: string): string {
  try {
    return new URL(url, 'http://admin.local').pathname
  } catch {
    return url.split('?')[0] ?? url
  }
}

const DIRECTORY_EMAILS: Readonly<Record<string, string>> = {
  '7': 'james@example.com',
  '8': 'maria@example.com',
  '74': 'leo@example.com',
}

function withUserEmail(record: Record<string, unknown>): Record<string, unknown> {
  const userId = String(record['userId'] ?? '')

  return {
    ...record,
    userEmail: DIRECTORY_EMAILS[userId] ?? null,
  }
}

function createdActivityRequest(body: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'ar-1',
    createdAt: '2026-09-12T12:00:00.000Z',
    kind: body['kind'] ?? 'sending',
    requestStatus: 'pending',
    requestedByName: body['requestedByName'] ?? 'Alex',
    reviewedAt: null,
    reviewedByName: null,
    reviewMessage: null,
    createdSendingId: body['createdSendingId'] ?? null,
    createdReceivingId: body['createdReceivingId'] ?? null,
    userId: body['userId'] ?? '7',
    transferStatus: body['transferStatus'] ?? 'pending',
    failureMessage: body['failureMessage'] ?? null,
    recipientAddress: body['recipientAddress'] ?? null,
    amount: body['amount'] ?? '0',
    symbol: body['symbol'] ?? 'ETH',
    usdAmount: body['usdAmount'] ?? null,
    assetChainId: body['assetChainId'] ?? null,
    assetStandard: body['assetStandard'] ?? null,
    assetAddress: body['assetAddress'] ?? null,
    assetName: body['assetName'] ?? null,
    assetDecimals: body['assetDecimals'] ?? null,
    assetIsVerified: body['assetIsVerified'] ?? null,
  }
}

function ensureActivityRequestForSending(body: Record<string, unknown>): {
  readonly status: number
  readonly record: Record<string, unknown>
} {
  const sendingId = String(body['sendingId'] ?? '')
  const existing = listedActivityRequests.find((item) => {
    const row = item as { createdSendingId?: string; requestStatus?: string }

    return (
      row.createdSendingId === sendingId &&
      (row.requestStatus === 'pending' || row.requestStatus === 'approved')
    )
  }) as Record<string, unknown> | undefined

  if (existing !== undefined) {
    return { status: 200, record: existing }
  }

  const sending = listedSendings.find((item) => (item as { id?: string }).id === sendingId) as
    | Record<string, unknown>
    | undefined
  const created = createdActivityRequest({
    kind: 'sending',
    requestedByName: body['requestedByName'],
    userId: sending?.['userId'] ?? '7',
    amount: sending?.['amount'] ?? '0',
    symbol: sending?.['symbol'] ?? 'ETH',
    transferStatus: sending?.['status'] ?? 'pending',
    recipientAddress: sending?.['recipientAddress'] ?? null,
    createdSendingId: sendingId,
  })
  listedActivityRequests = [created, ...listedActivityRequests]

  return { status: 201, record: created }
}

function ensureActivityRequestForReceiving(body: Record<string, unknown>): {
  readonly status: number
  readonly record: Record<string, unknown>
} {
  const receivingId = String(body['receivingId'] ?? '')
  const existing = listedActivityRequests.find((item) => {
    const row = item as { createdReceivingId?: string; requestStatus?: string }

    return (
      row.createdReceivingId === receivingId &&
      (row.requestStatus === 'pending' || row.requestStatus === 'approved')
    )
  }) as Record<string, unknown> | undefined

  if (existing !== undefined) {
    return { status: 200, record: existing }
  }

  const receiving = listedReceivings.find((item) => (item as { id?: string }).id === receivingId) as
    | Record<string, unknown>
    | undefined
  const created = createdActivityRequest({
    kind: 'receiving',
    requestedByName: body['requestedByName'],
    userId: receiving?.['userId'] ?? '7',
    amount: receiving?.['amount'] ?? '0',
    symbol: receiving?.['symbol'] ?? 'ETH',
    transferStatus: receiving?.['status'] ?? 'pending',
    recipientAddress: receiving?.['recipientAddress'] ?? null,
    usdAmount: receiving?.['usdAmount'] ?? null,
    createdReceivingId: receivingId,
  })
  listedActivityRequests = [created, ...listedActivityRequests]

  return { status: 201, record: created }
}

function applyActivityRequestAction(
  id: string,
  action: 'approve' | 'reject' | 'cancel',
  body: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const current = listedActivityRequests.find((item) => (item as { id?: string }).id === id) as
    Record<string, unknown> | undefined

  if (current === undefined) {
    return undefined
  }

  const next = {
    ...current,
    requestStatus:
      action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'cancelled',
    reviewedAt: '2026-09-12T13:00:00.000Z',
    reviewedByName: body['reviewedByName'] ?? null,
    reviewMessage: body['reviewMessage'] ?? null,
    createdSendingId:
      action === 'approve' && current['kind'] === 'sending'
        ? 's-approved'
        : (current['createdSendingId'] ?? null),
    createdReceivingId:
      action === 'approve' && current['kind'] === 'receiving'
        ? 'r-approved'
        : (current['createdReceivingId'] ?? null),
  }

  listedActivityRequests = listedActivityRequests.map((item) =>
    (item as { id?: string }).id === id ? next : item,
  )

  return next
}

function applyActivityRequestPatch(
  id: string,
  body: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const current = listedActivityRequests.find((item) => (item as { id?: string }).id === id) as
    Record<string, unknown> | undefined

  if (current === undefined) {
    return undefined
  }

  const next = {
    ...current,
    ...body,
    id: current['id'],
    createdAt: current['createdAt'],
    requestedByName: current['requestedByName'],
    userId: current['userId'],
    requestStatus: 'pending',
    reviewedAt: null,
    reviewedByName: null,
    reviewMessage: null,
    createdSendingId: current['createdSendingId'],
    createdReceivingId: current['createdReceivingId'],
  }

  listedActivityRequests = listedActivityRequests.map((item) =>
    (item as { id?: string }).id === id ? next : item,
  )

  return next
}

function directoryPage<T>(
  items: readonly T[],
  url: string,
  matches: (item: T, query: string) => boolean,
): { items: T[]; page: number; pageSize: number; total: number } {
  const parsed = new URL(url, 'http://admin.local')
  const page = Number(parsed.searchParams.get('page') ?? '1')
  const pageSize = Number(parsed.searchParams.get('pageSize') ?? '20')
  const query = parsed.searchParams.get('q') ?? ''
  const filtered = query.trim() === '' ? [...items] : items.filter((item) => matches(item, query))
  const start = (page - 1) * pageSize

  return {
    items: filtered.slice(start, start + pageSize),
    page,
    pageSize,
    total: filtered.length,
  }
}

function directorySendingsResponse(url: string, sendings: unknown[]): Response {
  const parsed = new URL(url, 'http://admin.local')
  const status = parsed.searchParams.get('status')
  const source =
    status === 'pending'
      ? sendings.filter((item) => (item as { status?: string }).status === 'pending')
      : sendings

  return jsonResponse(
    200,
    directoryPage(
      source.map((item) => withUserEmail(item as Record<string, unknown>)),
      url,
      (item, query) =>
        sendingMatchesAdminQuery(
          item as unknown as Parameters<typeof sendingMatchesAdminQuery>[0],
          query,
          typeof item['userEmail'] === 'string' ? item['userEmail'] : null,
        ),
    ),
  )
}

function serveDirectoryGet(url: string): Response | null {
  const path = requestPath(url)

  if (path === '/v1/admin/directory/users') {
    return jsonResponse(
      200,
      directoryPage([USER, MARIA, LEO], url, (user, query) =>
        userMatchesAdminQuery(user as never, query),
      ),
    )
  }

  if (path === '/v1/admin/directory/activity') {
    return jsonResponse(
      200,
      directoryPage(LOGIN_ACTIVITY.users, url, (row, query) =>
        activityMatchesAdminQuery(row, query),
      ),
    )
  }

  if (path === '/v1/admin/directory/sendings') {
    return directorySendingsResponse(url, listedSendings)
  }

  if (path === '/v1/admin/directory/receivings') {
    return jsonResponse(
      200,
      directoryPage(
        listedReceivings.map((item) => withUserEmail(item as Record<string, unknown>)),
        url,
        (item, query) =>
          sendingMatchesAdminQuery(
            item as unknown as Parameters<typeof sendingMatchesAdminQuery>[0],
            query,
            typeof item['userEmail'] === 'string' ? item['userEmail'] : null,
          ),
      ),
    )
  }

  if (path === '/v1/admin/directory/activity-requests') {
    const parsed = new URL(url, 'http://admin.local')
    const status = parsed.searchParams.get('status')
    const requestedBy = parsed.searchParams.get('requestedBy')?.trim().toLowerCase()
    let source =
      status === null || status === ''
        ? listedActivityRequests
        : listedActivityRequests.filter(
            (item) => (item as { requestStatus?: string }).requestStatus === status,
          )

    if (requestedBy !== undefined && requestedBy !== '') {
      source = source.filter(
        (item) =>
          String((item as { requestedByName?: string }).requestedByName ?? '')
            .trim()
            .toLowerCase() === requestedBy,
      )
    }

    const userId = parsed.searchParams.get('userId')?.trim()

    if (userId !== undefined && userId !== '') {
      source = source.filter((item) => (item as { userId?: string }).userId === userId)
    }

    return jsonResponse(
      200,
      directoryPage(
        source.map((item) => withUserEmail(item as Record<string, unknown>)),
        url,
        (item, query) => JSON.stringify(item).toLowerCase().includes(query.trim().toLowerCase()),
      ),
    )
  }

  return null
}

function serveUserTransfersGet(url: string): Response | null {
  const path = requestPath(url)
  const sendingsMatch = /^\/v1\/admin\/users\/([^/]+)\/sendings$/u.exec(path)

  if (sendingsMatch !== null) {
    const userId = sendingsMatch[1]
    const sendings = listedSendings.filter(
      (item) => (item as { userId?: string }).userId === userId,
    )

    return jsonResponse(200, { sendings })
  }

  const receivingsMatch = /^\/v1\/admin\/users\/([^/]+)\/receivings$/u.exec(path)

  if (receivingsMatch !== null) {
    const userId = receivingsMatch[1]
    const receivings = listedReceivings.filter(
      (item) => (item as { userId?: string }).userId === userId,
    )

    return jsonResponse(200, { receivings })
  }

  return null
}

function renderAdmin() {
  return render(
    <AppProviders services={services}>
      <AppRouter />
    </AppProviders>,
  )
}

beforeEach(() => {
  openPath('/admin')
  localStorage.clear()
  listedSendings = []
  listedReceivings = []
  listedActivityRequests = []
  forSendingDelayMs = 0
  services = createTestAppServices()
  appMarketCatalog.hydrate(
    parseMarketList([
      {
        id: 'ethereum',
        symbol: 'eth',
        name: 'Ethereum',
        current_price: 3284.12,
        market_cap_rank: 2,
        total_volume: 1,
        market_cap: 2,
        price_change_percentage_24h_in_currency: 0,
      },
      {
        id: 'usd-coin',
        symbol: 'usdc',
        name: 'USD Coin',
        current_price: 1,
        market_cap_rank: 7,
        total_volume: 1,
        market_cap: 2,
        price_change_percentage_24h_in_currency: 0,
      },
    ]),
  )

  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = requestUrl(input)
    const headers = new Headers(init?.headers)
    const pin = headers.get('x-admin-pin')
    const method = init?.method ?? 'GET'

    if (url.endsWith('/v1/admin/auth')) {
      const body = requestJson(init) as { pin?: string }

      if (body.pin === '9100') {
        return Promise.resolve(jsonResponse(200, { ok: true, role: 'super' }))
      }

      if (body.pin === '4200') {
        return Promise.resolve(jsonResponse(200, { ok: true, role: 'admin' }))
      }

      return Promise.resolve(jsonResponse(401, {}))
    }

    if (pin === '4200') {
      if (method === 'GET') {
        const directory = serveDirectoryGet(url)

        if (directory !== null) {
          return Promise.resolve(directory)
        }
      }

      if (url.endsWith('/v1/admin/users') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, { users: [USER, MARIA, LEO] }))
      }

      if (url.endsWith('/v1/admin/users/7') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, USER))
      }

      const userTransfers = serveUserTransfersGet(url)

      if (userTransfers !== null) {
        return Promise.resolve(userTransfers)
      }

      if (url.endsWith('/v1/admin/login-events') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, LOGIN_ACTIVITY))
      }

      if (url.endsWith('/v1/admin/sendings') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, { sendings: listedSendings }))
      }

      if (url.endsWith('/v1/admin/receivings') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, { receivings: listedReceivings }))
      }

      if (url.endsWith('/v1/admin/sendings') && method === 'POST') {
        const body = requestJson(init) as Record<string, unknown>

        return Promise.resolve(
          jsonResponse(201, {
            id: 's-admin',
            createdAt: '2026-09-07T12:00:00.000Z',
            userId: '7',
            status: body['status'] ?? 'pending',
            failureMessage: body['failureMessage'] ?? null,
            recipientAddress: body['recipientAddress'] ?? null,
            amount: body['amount'] ?? '0',
            symbol: body['symbol'] ?? 'ETH',
          }),
        )
      }

      if (url.endsWith('/v1/admin/receivings') && method === 'POST') {
        const body = requestJson(init) as Record<string, unknown>

        return Promise.resolve(
          jsonResponse(201, {
            id: 'r-admin',
            createdAt: '2026-09-07T12:00:00.000Z',
            userId: '7',
            status: body['status'] ?? 'pending',
            failureMessage: body['failureMessage'] ?? null,
            recipientAddress: body['recipientAddress'] ?? null,
            amount: body['amount'] ?? '0',
            symbol: body['symbol'] ?? 'ETH',
            usdAmount: body['usdAmount'] ?? null,
          }),
        )
      }

      if (url.endsWith('/v1/admin/activity-requests/for-sending') && method === 'POST') {
        const ensured = ensureActivityRequestForSending(requestJson(init) as Record<string, unknown>)

        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(jsonResponse(ensured.status, ensured.record))
          }, forSendingDelayMs)
        })
      }

      if (url.endsWith('/v1/admin/activity-requests/for-receiving') && method === 'POST') {
        const ensured = ensureActivityRequestForReceiving(requestJson(init) as Record<string, unknown>)

        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(jsonResponse(ensured.status, ensured.record))
          }, forSendingDelayMs)
        })
      }

      if (url.endsWith('/v1/admin/activity-requests') && method === 'POST') {
        const created = createdActivityRequest(requestJson(init) as Record<string, unknown>)
        listedActivityRequests = [created, ...listedActivityRequests]

        return Promise.resolve(jsonResponse(201, created))
      }

      const patchMatch = /^\/v1\/admin\/activity-requests\/([^/]+)$/u.exec(requestPath(url))

      if (patchMatch !== null && method === 'PATCH') {
        const next = applyActivityRequestPatch(
          patchMatch[1] ?? '',
          requestJson(init) as Record<string, unknown>,
        )

        if (next === undefined) {
          return Promise.resolve(jsonResponse(404, {}))
        }

        return Promise.resolve(jsonResponse(200, next))
      }

      return Promise.resolve(jsonResponse(403, {}))
    }

    if (pin !== '9100') {
      return Promise.resolve(jsonResponse(401, {}))
    }

    if (method === 'GET') {
      const directory = serveDirectoryGet(url)

      if (directory !== null) {
        return Promise.resolve(directory)
      }
    }

    if (url.endsWith('/v1/admin/users') && method === 'GET') {
      return Promise.resolve(jsonResponse(200, { users: [USER, MARIA, LEO] }))
    }

    if (url.endsWith('/v1/admin/login-events') && method === 'GET') {
      return Promise.resolve(jsonResponse(200, LOGIN_ACTIVITY))
    }

    if (url.endsWith('/v1/admin/sendings') && method === 'GET') {
      return Promise.resolve(jsonResponse(200, { sendings: listedSendings }))
    }

    const userTransfers = serveUserTransfersGet(url)

    if (userTransfers !== null) {
      return Promise.resolve(userTransfers)
    }

    if (url.endsWith('/v1/admin/sendings') && method === 'POST') {
      const body = requestJson(init) as Record<string, unknown>

      return Promise.resolve(
        jsonResponse(201, {
          id: 's-1',
          createdAt: '2026-09-07T12:00:00.000Z',
          userId: '7',
          status: body['status'] ?? 'pending',
          failureMessage: body['failureMessage'] ?? null,
          recipientAddress: body['recipientAddress'] ?? null,
          amount: body['amount'] ?? '0',
          symbol: body['symbol'] ?? 'ETH',
        }),
      )
    }

    if (url.endsWith('/v1/admin/receivings') && method === 'GET') {
      return Promise.resolve(jsonResponse(200, { receivings: listedReceivings }))
    }

    if (url.endsWith('/v1/admin/receivings') && method === 'POST') {
      const body = requestJson(init) as Record<string, unknown>

      return Promise.resolve(
        jsonResponse(201, {
          id: 'r-1',
          createdAt: '2026-09-07T12:00:00.000Z',
          userId: '7',
          status: body['status'] ?? 'pending',
          failureMessage: body['failureMessage'] ?? null,
          recipientAddress: body['recipientAddress'] ?? null,
          amount: body['amount'] ?? '0',
          symbol: body['symbol'] ?? 'ETH',
          usdAmount: body['usdAmount'] ?? null,
        }),
      )
    }

    if (url.includes('/v1/admin/sendings/') && method === 'DELETE') {
      const id = url.split('/').pop()
      listedSendings = listedSendings.filter((item) => (item as { id?: string }).id !== id)

      return Promise.resolve(jsonResponse(204, null))
    }

    if (url.includes('/v1/admin/receivings/') && method === 'DELETE') {
      const id = url.split('/').pop()
      listedReceivings = listedReceivings.filter((item) => (item as { id?: string }).id !== id)

      return Promise.resolve(jsonResponse(204, null))
    }

    if (url.includes('/v1/admin/receivings/') && method === 'PATCH') {
      const body = requestJson(init) as Record<string, unknown>
      const id = url.split('/').pop() ?? '0'

      return Promise.resolve(
        jsonResponse(200, {
          id,
          createdAt: '2026-08-22T15:10:00.000Z',
          userId: '7',
          status: body['status'] ?? 'pending',
          failureMessage: body['failureMessage'] ?? null,
          recipientAddress:
            body['recipientAddress'] ?? '0x6B175474E89094C44Da98b954EedeAC495271d0F',
          amount: body['amount'] ?? '12',
          symbol: body['symbol'] ?? 'USDC',
          usdAmount: body['usdAmount'] ?? '12.00',
        }),
      )
    }

    if (url.includes('/v1/admin/sendings/') && method === 'PATCH') {
      const body = requestJson(init) as Record<string, unknown>
      const id = url.split('/').pop() ?? '0'

      return Promise.resolve(
        jsonResponse(200, {
          id,
          createdAt: '2026-08-22T14:59:14.037Z',
          userId: '74',
          status: body['status'] ?? 'pending',
          failureMessage: body['failureMessage'] ?? null,
          recipientAddress:
            body['recipientAddress'] ?? '0x6B175474E89094C44Da98b954EedeAC495271d0F',
          amount: body['amount'] ?? '4',
          symbol: body['symbol'] ?? 'ETH',
        }),
      )
    }

    if (url.endsWith('/v1/admin/users/7') && method === 'GET') {
      return Promise.resolve(jsonResponse(200, USER))
    }

    if (url.endsWith('/v1/admin/users/8') && method === 'GET') {
      return Promise.resolve(jsonResponse(200, MARIA))
    }

    if (url.endsWith('/v1/admin/users/8') && method === 'PATCH') {
      const body = requestJson(init) as { wallets?: unknown }
      const wallets = body.wallets ?? MARIA.wallets

      return Promise.resolve(jsonResponse(200, { ...MARIA, wallets }))
    }

    if (url.endsWith('/v1/admin/users/7') && method === 'PATCH') {
      const body = requestJson(init) as {
        wallets?: { key: string; value: string }[]
        assets?: typeof USER.assets
      }
      const wallets = body.wallets ?? USER.wallets
      const assets = body.assets ?? USER.assets

      return Promise.resolve(jsonResponse(200, { ...USER, wallets, assets }))
    }

    if (url.endsWith('/v1/admin/activity-requests') && method === 'POST') {
      const created = createdActivityRequest(requestJson(init) as Record<string, unknown>)
      listedActivityRequests = [created, ...listedActivityRequests]

      return Promise.resolve(jsonResponse(201, created))
    }

    const patchMatch = /^\/v1\/admin\/activity-requests\/([^/]+)$/u.exec(requestPath(url))

    if (patchMatch !== null && method === 'PATCH') {
      const next = applyActivityRequestPatch(
        patchMatch[1] ?? '',
        requestJson(init) as Record<string, unknown>,
      )

      if (next === undefined) {
        return Promise.resolve(jsonResponse(404, {}))
      }

      return Promise.resolve(jsonResponse(200, next))
    }

    const reviewMatch = /\/v1\/admin\/activity-requests\/([^/]+)\/(approve|reject|cancel)$/u.exec(
      requestPath(url),
    )

    if (reviewMatch !== null && method === 'POST') {
      const action = reviewMatch[2]
      const next = applyActivityRequestAction(
        reviewMatch[1] ?? '',
        action === 'approve' || action === 'reject' || action === 'cancel' ? action : 'cancel',
        requestJson(init) as Record<string, unknown>,
      )

      if (next === undefined) {
        return Promise.resolve(jsonResponse(404, {}))
      }

      return Promise.resolve(jsonResponse(200, next))
    }

    return Promise.resolve(jsonResponse(404, {}))
  })
})

afterEach(() => {
  fetchSpy.mockRestore()
  localStorage.clear()
  sessionStorage.clear()
  window.location.hash = ''
})

describe('Admin cabinet', () => {
  it('asks for a PIN and admits the correct value', async () => {
    const user = userEvent.setup()
    renderAdmin()

    expect(await screen.findByRole('heading', { name: 'Admin' })).toBeInTheDocument()
    expect(screen.getByText('Enter your name, then the PIN.')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('PIN')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('PIN')).toHaveAttribute('autocomplete', 'one-time-code')
    expect(screen.getByRole('group', { name: 'PIN keypad' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Super Admin' }))
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
    expect(screen.getByLabelText('PIN')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('PIN')).toHaveAttribute('autocomplete', 'one-time-code')
    expect(screen.getByRole('button', { name: 'Super Admin' })).not.toHaveClass('text-amber-300')
    expect(screen.getByRole('heading', { name: 'Super Admin' })).toHaveClass('text-amber-300')
    expect(
      screen.getByText('Enter the PIN to manage users and wallet balances.'),
    ).toBeInTheDocument()
    for (const digit of ['9', '1', '0', '0']) {
      await user.click(screen.getByRole('button', { name: digit }))
    }

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument()
    expect(screen.getByText('Super Admin')).toBeInTheDocument()
    expect(await screen.findByText('james@example.com')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Avatar for james@example.com' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Activity' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Requests' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Sendings' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Receivings' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Email' })).not.toBeInTheDocument()
    expect(localStorage.getItem(ADMIN_PIN_STORAGE_KEY)).toBe('9100')
    expect(localStorage.getItem(ADMIN_NAME_STORAGE_KEY)).toBeNull()
  })

  it('does not admit a wrong PIN', async () => {
    const user = userEvent.setup()
    renderAdmin()

    await user.click(await screen.findByRole('button', { name: 'Super Admin' }))
    await user.type(screen.getByLabelText('PIN'), '0000')

    expect(await screen.findByText('That PIN is not accepted.')).toBeInTheDocument()
    expect(localStorage.getItem(ADMIN_PIN_STORAGE_KEY)).toBeNull()
  })

  it('does not admit a PIN from an unallowed address', async () => {
    fetchSpy.mockImplementation((input) => {
      const url = requestUrl(input)

      if (url.endsWith('/v1/admin/auth')) {
        return Promise.resolve(
          jsonResponse(403, {
            error: { code: 'address_not_allowed', message: 'This IP address is not allowed.' },
          }),
        )
      }

      return Promise.resolve(jsonResponse(500, {}))
    })

    const user = userEvent.setup()
    renderAdmin()

    await user.click(await screen.findByRole('button', { name: 'Super Admin' }))
    await user.type(screen.getByLabelText('PIN'), '9100')

    expect(await screen.findByText('This IP address is not allowed.')).toBeInTheDocument()
    expect(localStorage.getItem(ADMIN_PIN_STORAGE_KEY)).toBeNull()
  })

  it('does not accept an admin PIN until a name is entered', async () => {
    renderAdmin()

    await screen.findByLabelText('Name')
    expect(screen.getByLabelText('PIN')).toBeDisabled()
    expect(screen.getByRole('button', { name: '4' })).toBeDisabled()
    expect(screen.queryByRole('heading', { name: 'Users' })).not.toBeInTheDocument()
    expect(localStorage.getItem(ADMIN_PIN_STORAGE_KEY)).toBeNull()
  })

  it('saves the admin name, fills it next time, and overwrites it on a later sign-in', async () => {
    const user = userEvent.setup()
    renderAdmin()

    await user.type(await screen.findByLabelText('Name'), 'Alex')
    for (const digit of ['4', '2', '0', '0']) {
      await user.click(screen.getByRole('button', { name: digit }))
    }

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument()
    expect(screen.getByText('Alex')).toBeInTheDocument()
    expect(localStorage.getItem(ADMIN_NAME_STORAGE_KEY)).toBe('Alex')

    await user.click(screen.getByRole('button', { name: 'Lock' }))
    const nameField = await screen.findByLabelText('Name')
    expect(nameField).toHaveValue('Alex')

    await user.clear(nameField)
    await user.type(nameField, 'Maria')
    for (const digit of ['4', '2', '0', '0']) {
      await user.click(screen.getByRole('button', { name: digit }))
    }

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument()
    expect(localStorage.getItem(ADMIN_NAME_STORAGE_KEY)).toBe('Maria')
    expect(screen.getByText('Maria')).toBeInTheDocument()
    expect(screen.queryByText('Alex')).not.toBeInTheDocument()
  })

  it('does not sign the operator back in after Lock from a dumped PIN', async () => {
    const user = userEvent.setup()
    renderAdmin()

    await user.type(await screen.findByLabelText('Name'), 'Alex')
    for (const digit of ['4', '2', '0', '0']) {
      await user.click(screen.getByRole('button', { name: digit }))
    }

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Lock' }))
    expect(await screen.findByLabelText('Name')).toBeInTheDocument()
    expect(localStorage.getItem(ADMIN_PIN_STORAGE_KEY)).toBeNull()

    fireEvent.change(screen.getByLabelText('PIN'), { target: { value: '4200' } })

    expect(screen.queryByRole('heading', { name: 'Users' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(localStorage.getItem(ADMIN_PIN_STORAGE_KEY)).toBeNull()
  })

  it('rejects a super PIN while the admin role is selected', async () => {
    const user = userEvent.setup()
    renderAdmin()

    await user.type(await screen.findByLabelText('Name'), 'Alex')
    for (const digit of ['9', '1', '0', '0']) {
      await user.click(screen.getByRole('button', { name: digit }))
    }

    expect(await screen.findByText('That PIN is not accepted.')).toBeInTheDocument()
    expect(localStorage.getItem(ADMIN_PIN_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(ADMIN_NAME_STORAGE_KEY)).toBeNull()
  })

  it('a read PIN opens the cabinet without writes', async () => {
    const user = userEvent.setup()
    renderAdmin()

    await user.type(await screen.findByLabelText('Name'), 'Alex')
    for (const digit of ['4', '2', '0', '0']) {
      await user.click(screen.getByRole('button', { name: digit }))
    }

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.queryByText('Super Admin')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Activity' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Requests' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My requests' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Sendings' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Receivings' })).not.toBeInTheDocument()
    await waitFor(() => {
      expect(
        TestEventSource.instances.filter((source) =>
          source.url.includes('/v1/admin/activity-requests/stream'),
        ),
      ).toHaveLength(1)
    })
    expect(
      TestEventSource.instances.filter((source) => source.url.includes('/v1/sendings')),
    ).toHaveLength(0)

    await user.click(await screen.findByRole('link', { name: /james@example.com/i }))
    expect(await screen.findByRole('heading', { name: 'james@example.com' })).toBeInTheDocument()
    expect(screen.queryByLabelText('ETH receiving status')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('ETH value in USD')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('ETH amount')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save ETH' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ETH in ETH' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add crypto' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete user' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create sending' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create receiving' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Sending amount')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Receiving amount')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Account' }))
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Password (the_p)')).toBeInTheDocument()
    expect(screen.getByText('demo')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save account' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Spectator mode' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Wallets' }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save wallets' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument()
    const adminEtherscan = screen.getByRole('link', {
      name: 'Open address-receiving-funds on Etherscan',
    })
    expect(adminEtherscan).toHaveAttribute('href', `https://etherscan.io/address/${KEY}`)
    expect(adminEtherscan).toHaveAttribute('target', '_blank')
    expect(adminEtherscan.querySelector('img')?.getAttribute('src')).toBe('/logos/etherscan.svg')

    await user.click(screen.getByRole('button', { name: 'Sendings' }))
    expect(await screen.findByRole('heading', { name: 'Sendings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Request sending' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add sending' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create sending' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Sending amount')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Receivings' }))
    expect(await screen.findByRole('heading', { name: 'Receivings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Request receiving' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add receiving' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create receiving' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Receiving amount')).not.toBeInTheDocument()
  })

  it('a read PIN opens the Activity tab and lists authentications', async () => {
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '4200')
    renderAdmin()

    await user.click(await screen.findByRole('link', { name: 'Activity' }))

    expect(await screen.findByRole('heading', { name: 'Activity' })).toBeInTheDocument()
    expect(screen.getByText('2 users · 2 authentications.')).toBeInTheDocument()
    expect(screen.getByText('Never signed in')).toBeInTheDocument()
    expect(screen.getByText(/id 7 · 2 authentications/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /maria@example.com/i })).toHaveAttribute(
      'href',
      '/admin/users/8',
    )
    expect(screen.getByRole('link', { name: /maria@example.com/i }).className).toMatch(
      /hover:bg-accent/u,
    )
    expect(screen.getByRole('link', { name: /maria@example.com/i }).className).toMatch(
      /text-muted-foreground/u,
    )
    expect(screen.getByText(/id 7 · 2 authentications/).className).toMatch(/text-foreground/u)
    expect(
      fetchSpy.mock.calls.some((call) =>
        requestPath(requestUrl(call[0] as RequestInfo | URL)).endsWith(
          '/v1/admin/directory/activity',
        ),
      ),
    ).toBe(true)

    await user.click(screen.getByText(/id 7 · 2 authentications/))
    expect(document.querySelector('time[datetime="2026-09-08T12:04:21.000Z"]')).not.toBeNull()
    expect(document.querySelector('time[datetime="2026-09-07T08:12:03.000Z"]')).not.toBeNull()
    expect(screen.getAllByText('London, United Kingdom').length).toBeGreaterThan(0)

    const locationToggle = screen.getByRole('button', { name: /show location details/i })
    expect(locationToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('81.2.69.142')).not.toBeInTheDocument()

    await user.click(locationToggle)
    expect(locationToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('table', { name: 'Login location' })).toBeInTheDocument()
    expect(screen.getByText('81.2.69.142')).toBeInTheDocument()
    expect(screen.getAllByText('Europe/London').length).toBeGreaterThan(0)
    expect(screen.getAllByText('en-US').length).toBeGreaterThanOrEqual(3)
    expect(
      screen.getByRole('columnheader', { name: 'Most likely physical region' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Device timezone' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Device locale' })).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Public network egress' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Not available' })).toBeInTheDocument()
    expect(screen.getByText('GMT Standard Time')).toBeInTheDocument()
    expect(screen.getByText('242')).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'Windows Geo ID' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'Postal' })).toBeInTheDocument()
    expect(screen.getByText('GPS / Wi-Fi / cell triangulation')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })

  it('a read PIN opens a user Sendings tab as a view-only list', async () => {
    listedSendings = [
      {
        id: '62',
        createdAt: '2026-08-22T14:59:14.037Z',
        userId: '7',
        status: 'pending',
        failureMessage: null,
        recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        amount: '4',
        symbol: 'USDC',
      },
    ]

    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '4200')
    openPath('/admin/users/7?tab=sendings')
    renderAdmin()

    expect(await screen.findByRole('heading', { name: 'Sendings' })).toBeInTheDocument()
    expect((await screen.findAllByText('4 USDC')).length).toBeGreaterThan(0)
    expect(screen.getByText(/USD Coin · Ethereum/)).toBeInTheDocument()
    expect(screen.getByText(`To ${shortenAddress(RECIPIENT)}`)).toBeInTheDocument()
    expect(screen.getByText('id 62')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Edit$/ })).not.toBeInTheDocument()
    expect(
      TestEventSource.instances.filter((source) => source.url.includes('/v1/sendings')),
    ).toHaveLength(0)
  })

  it('a read PIN opens a user Receivings tab as a view-only list', async () => {
    listedReceivings = [
      {
        id: '81',
        createdAt: '2026-08-22T15:10:00.000Z',
        userId: '7',
        status: 'success',
        failureMessage: null,
        recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        amount: '2',
        symbol: 'ETH',
        usdAmount: '6568.24',
      },
    ]

    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '4200')
    openPath('/admin/users/7?tab=receivings')
    renderAdmin()

    expect(await screen.findByRole('heading', { name: 'Receivings' })).toBeInTheDocument()
    expect((await screen.findAllByText('2 ETH')).length).toBeGreaterThan(0)
    expect(screen.getByText(/Ether · Ethereum/)).toBeInTheDocument()
    expect(screen.getByText(`To ${shortenAddress(RECIPIENT)}`)).toBeInTheDocument()
    expect(screen.getByText('id 81')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Edit$/ })).not.toBeInTheDocument()
  })

  it('a super PIN also opens the Activity tab', async () => {
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    renderAdmin()

    await user.click(await screen.findByRole('link', { name: 'Activity' }))

    expect(await screen.findByRole('heading', { name: 'Activity' })).toBeInTheDocument()
    expect(screen.getByText('2 users · 2 authentications.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Sendings' })).not.toBeInTheDocument()
  })

  it('stays in the cabinet with a stored PIN', async () => {
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    renderAdmin()

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument()
    expect(screen.queryByLabelText('PIN')).not.toBeInTheDocument()
  })

  it('opens a profile and changes a wallet address', async () => {
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    renderAdmin()

    await user.click(await screen.findByRole('link', { name: /james@example.com/i }))

    expect(await screen.findByRole('heading', { name: 'james@example.com' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Avatar for james@example.com' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Spectator mode' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Assets' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Estimated total/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Wallets' }))
    const addressField = await screen.findByLabelText('Address for address-receiving-funds')
    const superEtherscan = screen.getByRole('link', {
      name: 'Open address-receiving-funds on Etherscan',
    })
    expect(superEtherscan).toHaveAttribute('href', `https://etherscan.io/address/${KEY}`)
    expect(superEtherscan.querySelector('img')?.getAttribute('src')).toBe('/logos/etherscan.svg')
    await user.clear(addressField)
    await user.type(addressField, '0x1234567890123456789012345678901234567890')
    expect(
      screen.getByRole('link', { name: 'Open address-receiving-funds on Etherscan' }),
    ).toHaveAttribute(
      'href',
      'https://etherscan.io/address/0x1234567890123456789012345678901234567890',
    )
    await user.click(screen.getByRole('button', { name: 'Save wallets' }))

    expect(await screen.findByText('Saved.')).toBeInTheDocument()
    expect(window.location.pathname).toContain('/admin/users/7')
  })

  it('keeps the profile header and section tabs fixed while the page scrolls', async () => {
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    renderAdmin()

    await user.click(await screen.findByRole('link', { name: /james@example.com/i }))

    const heading = await screen.findByRole('heading', { name: 'james@example.com' })
    const chrome = heading.closest('.sticky')

    expect(chrome).toHaveClass('top-14')
    expect(chrome).toContainElement(screen.getByRole('link', { name: 'All users' }))
    expect(chrome).toContainElement(screen.getByText('Profile section'))
    expect(chrome).toContainElement(screen.getByRole('button', { name: 'Assets' }))
    expect(chrome).not.toContainElement(screen.getByText(/Estimated total/i))
  })

  it('opens spectator mode in a new tab without leaving the cabinet', async () => {
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    renderAdmin()

    await user.click(await screen.findByRole('link', { name: /james@example.com/i }))
    const spectator = await screen.findByRole('link', { name: 'Spectator mode' })

    expect(spectator).toHaveAttribute('target', '_blank')
    expect(spectator).toHaveAttribute('rel', 'noopener noreferrer')
    const href = spectator.getAttribute('href') ?? ''
    expect(href).toContain('spectator=1')
    expect(href).toContain('clear=1')
    expect(href).toContain('email=james%40example.com')
    expect(href).toContain('the_p=demo')
    expect(window.location.pathname).toContain('/admin/users/7')

    await user.click(screen.getByRole('button', { name: 'Account' }))
    expect(screen.getByText('Password (the_p)')).toBeInTheDocument()
    expect(screen.getByText('demo')).toBeInTheDocument()
  })

  it('a read PIN opens spectator mode in a new tab without leaving the cabinet', async () => {
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '4200')
    renderAdmin()

    await user.click(await screen.findByRole('link', { name: /james@example.com/i }))
    const spectator = await screen.findByRole('link', { name: 'Spectator mode' })

    expect(spectator).toHaveAttribute('target', '_blank')
    expect(spectator).toHaveAttribute('rel', 'noopener noreferrer')
    const href = spectator.getAttribute('href') ?? ''
    expect(href).toContain('spectator=1')
    expect(href).toContain('clear=1')
    expect(href).toContain('email=james%40example.com')
    expect(href).toContain('the_p=demo')
    expect(window.location.pathname).toContain('/admin/users/7')
  })

  it('shows a mock wallet by default and adds a named wallet', async () => {
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    renderAdmin()

    await user.click(await screen.findByRole('link', { name: /maria@example.com/i }))
    await user.click(await screen.findByRole('button', { name: 'Wallets' }))

    expect(await screen.findByLabelText('Address for mock-wallet')).toHaveValue(
      '0x000000000000000000000000000000000000dEaD',
    )
    expect(screen.getByRole('link', { name: 'Open mock-wallet on Etherscan' })).toHaveAttribute(
      'href',
      'https://etherscan.io/address/0x000000000000000000000000000000000000dEaD',
    )

    await user.type(screen.getByLabelText('Wallet name'), 'Cold')
    await user.type(
      screen.getByLabelText('Wallet address'),
      '0x1234567890123456789012345678901234567890',
    )
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByLabelText('Address for cold')).toHaveValue(
      '0x1234567890123456789012345678901234567890',
    )

    await user.click(screen.getByRole('button', { name: 'Save wallets' }))
    expect(await screen.findByText('Saved.')).toBeInTheDocument()

    const patch = fetchSpy.mock.calls
      .map((call) => {
        const url = requestUrl(call[0] as RequestInfo | URL)
        const init = call[1]

        if (!url.endsWith('/v1/admin/users/8') || (init?.method ?? 'GET') !== 'PATCH') {
          return null
        }

        return requestJson(init) as {
          wallets?: Record<string, { key: string; value: string }>
        }
      })
      .find((body) => body !== null)

    expect(patch?.wallets).toMatchObject({
      'mock-wallet': {
        key: '0x000000000000000000000000000000000000dEaD',
      },
      cold: {
        key: '0x1234567890123456789012345678901234567890',
      },
    })
  })

  it('saves an asset amount in USD or in crypto', async () => {
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    renderAdmin()

    await user.click(await screen.findByRole('link', { name: /james@example.com/i }))

    const ethAmountStart = await screen.findByLabelText('ETH amount')
    expect(ethAmountStart).toHaveValue('2')
    expect(await screen.findByText('$6,568.24')).toBeInTheDocument()
    expect(screen.getByText('≈ $6,568.24')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ETH in ETH' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.queryByLabelText('ETH receiving status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save ETH' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'ETH in USD' }))
    const ethUsd = await screen.findByLabelText('ETH value in USD')
    expect(ethUsd).toHaveValue('6568.24')
    expect(screen.getByText('≈ 2 ETH')).toBeInTheDocument()

    await user.clear(ethUsd)
    await user.type(ethUsd, '9852.36')
    expect(await screen.findByText('$9,852.36')).toBeInTheDocument()
    expect(screen.getByText('≈ 3 ETH')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save ETH' }))
    expect(await screen.findByText('Saved.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'USDC in USD' }))
    const usdcUsd = await screen.findByLabelText('USDC value in USD')
    await user.clear(usdcUsd)
    await user.type(usdcUsd, '1.5')
    expect(screen.getByText('≈ 1.5 USDC')).toBeInTheDocument()
    expect(screen.getByText('$9,853.86')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save USDC' }))
    expect(await screen.findByText('Saved.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ETH in ETH' }))
    const ethAmount = await screen.findByLabelText('ETH amount')
    expect(ethAmount).toHaveValue('3')
    expect(screen.getByText('≈ $9,852.36')).toBeInTheDocument()

    await user.clear(ethAmount)
    await user.type(ethAmount, '1')
    expect(await screen.findByText('≈ $3,284.12')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save ETH' }))
    expect(await screen.findByText('Saved.')).toBeInTheDocument()

    const patches = fetchSpy.mock.calls
      .map((call) => {
        const url = requestUrl(call[0] as RequestInfo | URL)
        const init = call[1]
        const method = init?.method ?? 'GET'

        if (!url.endsWith('/v1/admin/users/7') || method !== 'PATCH') {
          return null
        }

        return requestJson(init) as {
          assets?: { tokens?: { symbol: string; balance: string }[] }
        }
      })
      .filter((body) => body?.assets !== undefined)

    expect(patches[0]?.assets?.tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ symbol: 'ETH', balance: '3000000000000000000' }),
      ]),
    )
    expect(patches[1]?.assets?.tokens).toEqual(
      expect.arrayContaining([expect.objectContaining({ symbol: 'USDC', balance: '1500000' })]),
    )
    expect(patches[2]?.assets?.tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ symbol: 'ETH', balance: '1000000000000000000' }),
      ]),
    )
  })

  it('creates a sending and a receiving from the user profile tabs', async () => {
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    renderAdmin()

    await user.click(await screen.findByRole('link', { name: /james@example.com/i }))
    expect(await screen.findByRole('button', { name: 'Assets' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.queryByLabelText('Sending amount')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Receiving amount')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sendings' }))
    expect(screen.getByRole('button', { name: 'Sendings' })).toHaveAttribute('aria-pressed', 'true')
    expect(window.location.search).toContain('tab=sendings')
    expect(await screen.findByText('No sendings yet')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add sending' }))
    expect(screen.getByLabelText('Sending amount')).not.toHaveAttribute('placeholder')
    expect(screen.getByLabelText('Recipient')).not.toHaveAttribute('placeholder')

    await user.type(screen.getByLabelText('Sending amount'), '0.01')
    expect(await screen.findByText('≈ $32.84')).toBeInTheDocument()
    await user.type(
      screen.getByLabelText('Recipient'),
      '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
    )
    await user.click(screen.getByRole('button', { name: 'Create sending' }))

    expect(await screen.findByText('Sending created (pending).')).toBeInTheDocument()
    expect(screen.queryByText('No sendings yet')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Receivings' }))
    expect(screen.getByRole('button', { name: 'Receivings' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(window.location.search).toContain('tab=receivings')
    expect(await screen.findByText('No receivings yet')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add receiving' }))
    expect(screen.getByLabelText('Receiving amount')).not.toHaveAttribute('placeholder')

    await user.type(screen.getByLabelText('Receiving amount'), '0.15')
    expect(await screen.findByText('≈ $492.62')).toBeInTheDocument()
    expect(screen.queryByLabelText('USD (optional)')).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText('Receiving amount'))
    await user.click(screen.getByLabelText('Receiving asset'))
    await user.click(screen.getByRole('option', { name: 'Select USDT on Ethereum' }))
    await user.type(screen.getByLabelText('Receiving amount'), '0.2')
    await user.click(screen.getByRole('button', { name: 'Create receiving' }))

    expect(await screen.findByText('Receiving created (pending).')).toBeInTheDocument()
    expect(screen.queryByText('No receivings yet')).not.toBeInTheDocument()

    const posts = fetchSpy.mock.calls
      .map((call) => {
        const url = requestUrl(call[0] as RequestInfo | URL)
        const init = call[1]
        const method = init?.method ?? 'GET'

        if (method !== 'POST') {
          return null
        }

        if (url.endsWith('/v1/admin/sendings')) {
          return { kind: 'sending', body: requestJson(init) }
        }

        if (url.endsWith('/v1/admin/receivings')) {
          return { kind: 'receiving', body: requestJson(init) }
        }

        return null
      })
      .filter((item) => item !== null)

    expect(posts).toEqual(
      expect.arrayContaining([
        {
          kind: 'sending',
          body: expect.objectContaining({
            userId: '7',
            amount: '0.01',
            symbol: 'ETH',
            assetChainId: '1',
            assetStandard: 'native',
            assetAddress: null,
            assetName: 'Ether',
            assetDecimals: 18,
            assetIsVerified: true,
            recipientAddress: '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
            status: 'pending',
          }),
        },
        {
          kind: 'receiving',
          body: expect.objectContaining({
            userId: '7',
            amount: '0.2',
            symbol: 'USDT',
            assetChainId: '1',
            assetStandard: 'ERC-20',
            assetAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            assetName: 'Tether USD',
            assetDecimals: 6,
            assetIsVerified: true,
            status: 'pending',
          }),
        },
      ]),
    )
  })

  it('does not create a sending larger than the user holding', async () => {
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    renderAdmin()

    await user.click(await screen.findByRole('link', { name: /james@example.com/i }))
    await user.click(screen.getByRole('button', { name: 'Sendings' }))
    await user.click(await screen.findByRole('button', { name: 'Add sending' }))
    await user.click(screen.getByLabelText('Sending asset'))
    expect(screen.getByRole('option', { name: 'Select ETH on Ethereum' })).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: 'Select USDC on Ethereum' }),
    ).not.toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.type(screen.getByLabelText('Sending amount'), '3')
    expect(screen.getByRole('alert')).toHaveTextContent('Not enough ETH to create this sending.')
    expect(screen.getByLabelText('Sending amount')).toHaveAttribute('aria-invalid', 'true')
    await user.type(
      screen.getByLabelText('Recipient'),
      '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
    )
    await user.click(screen.getByRole('button', { name: 'Create sending' }))

    expect(screen.getByText('Not enough ETH to create this sending.')).toBeInTheDocument()
    expect(
      fetchSpy.mock.calls.some((call) => {
        const url = requestUrl(call[0] as RequestInfo | URL)
        const method = call[1]?.method ?? 'GET'

        return method === 'POST' && url.endsWith('/v1/admin/sendings')
      }),
    ).toBe(false)
  })

  it('does not request a sending larger than the user holding', async () => {
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '4200')
    localStorage.setItem(ADMIN_NAME_STORAGE_KEY, 'Alex')
    renderAdmin()

    await user.click(await screen.findByRole('link', { name: /james@example.com/i }))
    await user.click(screen.getByRole('button', { name: 'Sendings' }))
    await user.click(await screen.findByRole('button', { name: 'Request sending' }))
    await user.type(screen.getByLabelText('Sending amount'), '3')
    expect(screen.getByRole('alert')).toHaveTextContent('Not enough ETH to create this sending.')
    expect(screen.getByLabelText('Sending amount')).toHaveAttribute('aria-invalid', 'true')
    await user.type(
      screen.getByLabelText('Recipient'),
      '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
    )
    await user.click(screen.getByRole('button', { name: 'Submit request' }))

    expect(screen.getByText('Not enough ETH to create this sending.')).toBeInTheDocument()
    expect(
      fetchSpy.mock.calls.some((call) => {
        const url = requestUrl(call[0] as RequestInfo | URL)
        const method = call[1]?.method ?? 'GET'

        return method === 'POST' && url.endsWith('/v1/admin/activity-requests')
      }),
    ).toBe(false)
  })

  it('submits a sending request without creating a sending', async () => {
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '4200')
    localStorage.setItem(ADMIN_NAME_STORAGE_KEY, 'Alex')
    renderAdmin()

    await user.click(await screen.findByRole('link', { name: /james@example.com/i }))
    await user.click(screen.getByRole('button', { name: 'Sendings' }))
    expect(await screen.findByText('No sendings yet')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Request sending' }))
    await user.type(screen.getByLabelText('Sending amount'), '0.01')
    await user.type(
      screen.getByLabelText('Recipient'),
      '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
    )
    await user.click(screen.getByRole('button', { name: 'Submit request' }))

    expect(
      await screen.findByText('Request submitted. Super Admin will review it.'),
    ).toBeInTheDocument()
    expect(screen.getByText('No sendings yet')).toBeInTheDocument()

    const posts = fetchSpy.mock.calls
      .map((call) => {
        const url = requestUrl(call[0] as RequestInfo | URL)
        const init = call[1]
        const method = init?.method ?? 'GET'

        if (method !== 'POST') {
          return null
        }

        return { url, body: requestJson(init) }
      })
      .filter((item) => item !== null)

    expect(posts.some((item) => item.url.endsWith('/v1/admin/sendings'))).toBe(false)
    expect(posts).toEqual(
      expect.arrayContaining([
        {
          url: expect.stringMatching(/\/v1\/admin\/activity-requests$/u),
          body: expect.objectContaining({
            kind: 'sending',
            requestedByName: 'Alex',
            userId: '7',
            amount: '0.01',
            symbol: 'ETH',
            assetChainId: '1',
            assetStandard: 'native',
            assetAddress: null,
            assetName: 'Ether',
            assetDecimals: 18,
            assetIsVerified: true,
            recipientAddress: '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
            transferStatus: 'pending',
          }),
        },
      ]),
    )

    expect(screen.queryByRole('link', { name: 'Requests' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My requests' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Handle/ })).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Awaiting Super Admin' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Change sending request from Alex' }))
    const amount = screen.getByLabelText('Amount')
    await user.clear(amount)
    await user.type(amount, '3')
    await user.click(screen.getByRole('button', { name: 'Send for approval' }))

    expect(await screen.findByText('Change sent for Super Admin approval.')).toBeInTheDocument()
    expect(
      fetchSpy.mock.calls.some((call) => {
        const url = requestUrl(call[0] as RequestInfo | URL)
        return (
          (call[1]?.method ?? 'GET') === 'PATCH' && url.endsWith('/v1/admin/activity-requests/ar-1')
        )
      }),
    ).toBe(true)
  })

  it('sends a chosen failure reason on a sending request', async () => {
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '4200')
    localStorage.setItem(ADMIN_NAME_STORAGE_KEY, 'Alex')
    openPath('/admin/users/7?tab=sendings')
    renderAdmin()

    await user.click(await screen.findByRole('button', { name: 'Request sending' }))
    await user.type(screen.getByLabelText('Sending amount'), '0.01')
    await user.type(
      screen.getByLabelText('Recipient'),
      '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
    )
    expect(screen.getByLabelText('Failure reason')).toBeDisabled()
    await user.click(screen.getByLabelText('Sending status'))
    await user.click(screen.getByRole('option', { name: 'failure' }))
    expect(screen.getByLabelText('Sending status').className).toMatch(/text-destructive/u)
    expect(screen.getByLabelText('Failure reason')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Submit request' })).toBeDisabled()
    await user.click(screen.getByLabelText('Failure reason'))
    await user.click(screen.getByRole('option', { name: 'Blocked by admin' }))
    await user.click(screen.getByRole('button', { name: 'Submit request' }))

    expect(
      await screen.findByText('Request submitted. Super Admin will review it.'),
    ).toBeInTheDocument()

    const posts = fetchSpy.mock.calls
      .map((call) => {
        const url = requestUrl(call[0] as RequestInfo | URL)
        const init = call[1]
        const method = init?.method ?? 'GET'

        if (method !== 'POST') {
          return null
        }

        return { url, body: requestJson(init) }
      })
      .filter((item) => item !== null)

    expect(posts).toEqual(
      expect.arrayContaining([
        {
          url: expect.stringMatching(/\/v1\/admin\/activity-requests$/u),
          body: expect.objectContaining({
            kind: 'sending',
            transferStatus: 'failure',
            failureMessage: 'Blocked by admin',
          }),
        },
      ]),
    )
  })

  it('sends a chosen failure reason on a receiving request', async () => {
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '4200')
    localStorage.setItem(ADMIN_NAME_STORAGE_KEY, 'Alex')
    openPath('/admin/users/7?tab=receivings')
    renderAdmin()

    await user.click(await screen.findByRole('button', { name: 'Request receiving' }))
    await user.type(screen.getByLabelText('Receiving amount'), '0.15')
    expect(screen.getByLabelText('Failure reason')).toBeDisabled()
    await user.click(screen.getByLabelText('Receiving status'))
    await user.click(screen.getByRole('option', { name: 'failure' }))
    expect(screen.getByRole('button', { name: 'Submit request' })).toBeDisabled()
    await user.click(screen.getByLabelText('Failure reason'))
    await user.click(screen.getByRole('option', { name: 'Held for compliance review' }))
    await user.click(screen.getByRole('button', { name: 'Submit request' }))

    expect(
      await screen.findByText('Request submitted. Super Admin will review it.'),
    ).toBeInTheDocument()

    const posts = fetchSpy.mock.calls
      .map((call) => {
        const url = requestUrl(call[0] as RequestInfo | URL)
        const init = call[1]
        const method = init?.method ?? 'GET'

        if (method !== 'POST') {
          return null
        }

        return { url, body: requestJson(init) }
      })
      .filter((item) => item !== null)

    expect(posts).toEqual(
      expect.arrayContaining([
        {
          url: expect.stringMatching(/\/v1\/admin\/activity-requests$/u),
          body: expect.objectContaining({
            kind: 'receiving',
            transferStatus: 'failure',
            failureMessage: 'Held for compliance review',
          }),
        },
      ]),
    )
  })

  it('does not fill recipient on a new sending request', async () => {
    listedSendings = [
      {
        ...PENDING_SENDING,
        userId: '7',
        amount: '1.992567',
        symbol: 'ETH',
        status: 'success',
      },
    ]
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '4200')
    localStorage.setItem(ADMIN_NAME_STORAGE_KEY, 'Alex')
    openPath('/admin/users/7?tab=sendings')
    renderAdmin()

    expect(await screen.findByRole('heading', { name: 'james@example.com' })).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Request sending' }))

    expect(screen.queryByLabelText('Existing sending')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Recipient')).toHaveValue('')
  })

  it('opens or creates a sending request from the card', async () => {
    listedSendings = [
      {
        ...PENDING_SENDING,
        userId: '7',
        amount: '1.992567',
        symbol: 'ETH',
        status: 'success',
      },
    ]
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '4200')
    localStorage.setItem(ADMIN_NAME_STORAGE_KEY, 'Alex')
    openPath('/admin/users/7?tab=sendings')
    renderAdmin()

    expect(await screen.findByRole('heading', { name: 'james@example.com' })).toBeInTheDocument()
    expect(await screen.findByText(/id 61/)).toBeInTheDocument()

    forSendingDelayMs = 80
    await user.click(await screen.findByRole('button', { name: 'Request' }))
    expect(screen.getByRole('button', { name: 'Request' })).toHaveAttribute('aria-busy', 'true')
    expect(await screen.findByRole('button', { name: 'Send for approval' })).toBeInTheDocument()
    expect(screen.getByLabelText('Amount')).toHaveValue('1.992567')

    const posts = fetchSpy.mock.calls
      .map((call) => {
        const url = requestUrl(call[0] as RequestInfo | URL)
        const init = call[1]
        const method = init?.method ?? 'GET'

        if (method !== 'POST') {
          return null
        }

        return { url, body: requestJson(init) }
      })
      .filter((item) => item !== null)

    expect(posts.some((item) => item.url.endsWith('/v1/admin/sendings'))).toBe(false)
    expect(posts).toEqual(
      expect.arrayContaining([
        {
          url: expect.stringMatching(/\/v1\/admin\/activity-requests\/for-sending$/u),
          body: expect.objectContaining({
            sendingId: '61',
            requestedByName: 'Alex',
          }),
        },
      ]),
    )

    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.click(screen.getByRole('button', { name: 'Request' }))
    expect(await screen.findByRole('button', { name: 'Send for approval' })).toBeInTheDocument()

    const forSending = fetchSpy.mock.calls.filter((call) => {
      const url = requestUrl(call[0] as RequestInfo | URL)
      return (call[1]?.method ?? 'GET') === 'POST' && url.endsWith('/v1/admin/activity-requests/for-sending')
    })
    expect(forSending).toHaveLength(2)
  })

  it('opens or creates a receiving request from the card', async () => {
    listedReceivings = [
      {
        id: '81',
        createdAt: '2026-08-22T15:10:00.000Z',
        userId: '7',
        status: 'pending',
        failureMessage: null,
        recipientAddress: null,
        amount: '120',
        symbol: 'USDC',
        usdAmount: '119.98',
      },
    ]
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '4200')
    localStorage.setItem(ADMIN_NAME_STORAGE_KEY, 'Alex')
    openPath('/admin/users/7?tab=receivings')
    renderAdmin()

    expect(await screen.findByRole('heading', { name: 'james@example.com' })).toBeInTheDocument()
    expect(await screen.findByText(/id 81/)).toBeInTheDocument()

    forSendingDelayMs = 80
    await user.click(await screen.findByRole('button', { name: 'Request' }))
    expect(screen.getByRole('button', { name: 'Request' })).toHaveAttribute('aria-busy', 'true')
    expect(await screen.findByRole('button', { name: 'Send for approval' })).toBeInTheDocument()
    expect(screen.getByLabelText('Amount')).toHaveValue('120')

    const posts = fetchSpy.mock.calls
      .map((call) => {
        const url = requestUrl(call[0] as RequestInfo | URL)
        const init = call[1]
        const method = init?.method ?? 'GET'

        if (method !== 'POST') {
          return null
        }

        return { url, body: requestJson(init) }
      })
      .filter((item) => item !== null)

    expect(posts.some((item) => item.url.endsWith('/v1/admin/receivings'))).toBe(false)
    expect(posts).toEqual(
      expect.arrayContaining([
        {
          url: expect.stringMatching(/\/v1\/admin\/activity-requests\/for-receiving$/u),
          body: expect.objectContaining({
            receivingId: '81',
            requestedByName: 'Alex',
          }),
        },
      ]),
    )

    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.click(screen.getByRole('button', { name: 'Request' }))
    expect(await screen.findByRole('button', { name: 'Send for approval' })).toBeInTheDocument()

    const forReceiving = fetchSpy.mock.calls.filter((call) => {
      const url = requestUrl(call[0] as RequestInfo | URL)
      return (call[1]?.method ?? 'GET') === 'POST' && url.endsWith('/v1/admin/activity-requests/for-receiving')
    })
    expect(forReceiving).toHaveLength(2)
  })

  it('opens My requests for a regular admin and lets them change their draft', async () => {
    listedActivityRequests = [
      { ...PENDING_ACTIVITY_REQUEST },
      { ...PENDING_ACTIVITY_REQUEST, id: 'ar-maria', requestedByName: 'Maria' },
    ]
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '4200')
    localStorage.setItem(ADMIN_NAME_STORAGE_KEY, 'Alex')
    openPath('/admin/requests')
    renderAdmin()

    expect(await screen.findByRole('heading', { name: 'My requests' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My requests' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Requests' })).not.toBeInTheDocument()
    expect(screen.getByRole('listitem')).toHaveTextContent('Alex')
    expect(screen.queryByText('Maria')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Change sending request from Alex' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Handle/ })).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Change sending request from Alex' }))
    expect(await screen.findByRole('button', { name: 'Send for approval' })).toBeInTheDocument()
  })

  it("lists this user's requests for the signed-in admin on the profile Requests tab", async () => {
    listedActivityRequests = [
      PENDING_ACTIVITY_REQUEST,
      { ...PENDING_ACTIVITY_REQUEST, id: 'ar-maria', requestedByName: 'Maria' },
      { ...PENDING_ACTIVITY_REQUEST, id: 'ar-other-user', userId: '8' },
    ]
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '4200')
    localStorage.setItem(ADMIN_NAME_STORAGE_KEY, 'Alex')
    openPath('/admin/users/7?tab=requests')
    renderAdmin()

    expect(await screen.findByRole('heading', { name: 'james@example.com' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'My requests' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(await screen.findByRole('heading', { name: 'Requests' })).toBeInTheDocument()
    expect(screen.getByText(/1 request for this user in your name/u)).toBeInTheDocument()
    expect(screen.getByRole('listitem')).toHaveTextContent('Alex')
    expect(screen.queryByText('Maria')).not.toBeInTheDocument()
    expect(screen.queryByText('maria@example.com')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Change sending request from Alex' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Handle/ })).not.toBeInTheDocument()
    expect(window.location.search).toContain('tab=requests')
  })

  it("lists every admin's requests for this user when Super opens the profile Requests tab", async () => {
    listedActivityRequests = [
      PENDING_ACTIVITY_REQUEST,
      { ...PENDING_ACTIVITY_REQUEST, id: 'ar-maria', requestedByName: 'Maria' },
      { ...PENDING_ACTIVITY_REQUEST, id: 'ar-other-user', userId: '8' },
    ]
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    openPath('/admin/users/7?tab=requests')
    renderAdmin()

    expect(await screen.findByRole('heading', { name: 'james@example.com' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Requests' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByRole('heading', { name: 'Requests' })).toBeInTheDocument()
    expect(screen.getByText(/2 requests for this user/u)).toBeInTheDocument()
    expect(screen.getByText('Alex')).toBeInTheDocument()
    expect(screen.getByText('Maria')).toBeInTheDocument()
    expect(screen.queryByText('maria@example.com')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Handle sending request from Alex' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Handle sending request from Maria' }),
    ).toBeInTheDocument()
  })

  it('lets a regular admin change an approved request so Super Admin can review it', async () => {
    listedActivityRequests = [
      {
        ...PENDING_ACTIVITY_REQUEST,
        id: 'ar-approved',
        kind: 'receiving',
        requestStatus: 'approved',
        requestedByName: 'Alex',
        reviewedAt: '2026-09-12T13:00:00.000Z',
        reviewedByName: 'Super',
        createdReceivingId: 'r-1',
        amount: '12000',
        symbol: 'USDT',
        usdAmount: '1199.76',
      },
    ]
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '4200')
    localStorage.setItem(ADMIN_NAME_STORAGE_KEY, 'Alex')
    openPath('/admin/requests')
    renderAdmin()

    expect(
      await screen.findByRole('button', { name: 'Change receiving request from Alex' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/^approved$/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Handle/ })).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Change receiving request from Alex' }))
    expect(await screen.findByRole('button', { name: 'Send for approval' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText('Amount'))
    await user.type(screen.getByLabelText('Amount'), '13000')
    await user.click(screen.getByRole('button', { name: 'Send for approval' }))

    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some((call) => {
          const url = requestUrl(call[0] as RequestInfo | URL)
          return (
            (call[1]?.method ?? 'GET') === 'PATCH' &&
            url.endsWith('/v1/admin/activity-requests/ar-approved')
          )
        }),
      ).toBe(true)
    })

    expect(await screen.findByText('Change sent for Super Admin approval.')).toBeInTheDocument()
    expect(screen.getByText('Awaiting')).toBeInTheDocument()
  })

  it('lets Super Admin approve a pending request from the Requests tab', async () => {
    listedActivityRequests = [{ ...PENDING_ACTIVITY_REQUEST }]
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    renderAdmin()

    await user.click(await screen.findByRole('link', { name: 'Requests' }))
    expect(
      await screen.findByRole('button', { name: 'Handle sending request from Alex' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel request' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Handle sending request from Alex' }))
    expect(await screen.findByRole('heading', { name: 'Alex' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sending' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Receiving' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Amount')).toHaveValue('0.01')
    expect(screen.getByLabelText('Recipient')).toHaveValue(
      '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
    )
    expect(screen.queryByRole('button', { name: 'Cancel request' })).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText('Amount'))
    await user.type(screen.getByLabelText('Amount'), '1.5')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(
        fetchSpy.mock.calls.some((call) => {
          const url = requestUrl(call[0] as RequestInfo | URL)
          const method = call[1]?.method ?? 'GET'

          return method === 'PATCH' && url.endsWith('/v1/admin/activity-requests/ar-pending')
        }),
      ).toBe(true)
    })

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.getByLabelText('Amount')).toHaveValue('1.5')

    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    })

    const methods = fetchSpy.mock.calls
      .map((call) => {
        const url = requestUrl(call[0] as RequestInfo | URL)
        const method = call[1]?.method ?? 'GET'

        if (!url.includes('/v1/admin/activity-requests/ar-pending')) {
          return null
        }

        return method
      })
      .filter((item) => item !== null)

    expect(methods.filter((method) => method === 'PATCH').length).toBeGreaterThanOrEqual(2)
    expect(methods).toContain('POST')
    expect(
      fetchSpy.mock.calls.some((call) => {
        const url = requestUrl(call[0] as RequestInfo | URL)
        const method = call[1]?.method ?? 'GET'

        return method === 'POST' && url.endsWith('/v1/admin/activity-requests/ar-pending/approve')
      }),
    ).toBe(true)
  })

  it('restores the profile tab from the query string and lists that user', async () => {
    listedSendings = [{ ...PENDING_SENDING, userId: '7' }]
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    openPath('/admin/users/7?tab=sendings')
    renderAdmin()

    expect(await screen.findByRole('heading', { name: 'james@example.com' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sendings' })).toHaveAttribute('aria-pressed', 'true')
    expect((await screen.findAllByText('2 ETH')).length).toBeGreaterThan(0)
    expect(await screen.findByRole('button', { name: 'Add sending' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Sending amount')).not.toBeInTheDocument()
  })

  it('adds a cryptocurrency from the Assets header menu', async () => {
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    renderAdmin()

    await user.click(await screen.findByRole('link', { name: /james@example.com/i }))
    await screen.findByLabelText('ETH amount')

    await user.click(screen.getByRole('button', { name: 'Add crypto' }))
    const usdt = await screen.findByRole('menuitem', { name: 'Add USDT on Ethereum' })
    expect(usdt.querySelector('img')?.getAttribute('src')).toBe('/logos/usdt.svg')

    await user.click(usdt)
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
    expect(screen.getByLabelText('USDT amount')).toHaveValue('0')

    const patch = fetchSpy.mock.calls
      .map((call) => {
        const url = requestUrl(call[0] as RequestInfo | URL)
        const init = call[1]
        const method = init?.method ?? 'GET'

        if (!url.endsWith('/v1/admin/users/7') || method !== 'PATCH') {
          return null
        }

        return requestJson(init) as {
          assets?: { tokens?: { symbol: string; chainId: string; balance: string }[] }
        }
      })
      .find((body) => body?.assets?.tokens?.some((token) => token.symbol === 'USDT'))

    expect(patch?.assets?.tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: 'USDT',
          chainId: '1',
          balance: '0',
        }),
      ]),
    )
  })

  it('finds a user by wallet address', async () => {
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    renderAdmin()

    expect(await screen.findByText('james@example.com')).toBeInTheDocument()
    expect(screen.getByText('maria@example.com')).toBeInTheDocument()

    await user.type(
      screen.getByRole('searchbox', { name: 'Search email or Wallet address' }),
      '5aaeb605',
    )

    expect(screen.getByRole('status')).toHaveTextContent('Searching users')

    await waitFor(() => {
      expect(screen.getByText('james@example.com')).toBeInTheDocument()
      expect(screen.queryByText('maria@example.com')).not.toBeInTheDocument()
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('pins a user above the directory and unpins them back into the list', async () => {
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    renderAdmin()

    expect(await screen.findByText('james@example.com')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pinned' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pin james@example.com' })).toHaveAttribute(
      'title',
      'Pin james@example.com above the directory',
    )

    await user.click(screen.getByRole('button', { name: 'Pin james@example.com' }))

    expect(screen.getByRole('heading', { name: 'Pinned' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unpin james@example.com' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Unpin james@example.com' })).toHaveAttribute(
      'title',
      'Unpin james@example.com — they go back into the directory list',
    )
    expect(localStorage.getItem(ADMIN_PINNED_USERS_STORAGE_KEY)).toBe(JSON.stringify(['7']))
    expect(screen.getByRole('button', { name: 'Pin maria@example.com' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Unpin james@example.com' }))

    expect(screen.queryByRole('heading', { name: 'Pinned' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pin james@example.com' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(localStorage.getItem(ADMIN_PINNED_USERS_STORAGE_KEY)).toBe(JSON.stringify([]))
  })

  it('opens a user Sendings tab and lists that user\'s records', async () => {
    listedSendings = [
      {
        id: '61',
        createdAt: '2026-08-22T14:44:10.949Z',
        userId: '7',
        status: 'pending',
        failureMessage: null,
        recipientAddress: RECIPIENT,
        amount: '2',
        symbol: 'ETH',
      },
    ]
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    openPath('/admin/users/7?tab=sendings')
    renderAdmin()

    expect(await screen.findByRole('heading', { name: 'Sendings' })).toBeInTheDocument()
    expect((await screen.findAllByText('2 ETH')).length).toBeGreaterThan(0)
    expect(screen.getByText(/Ether · Ethereum/)).toBeInTheDocument()
    expect(screen.getByText(`To ${shortenAddress(RECIPIENT)}`)).toBeInTheDocument()
    expect(screen.getByText('id 61')).toBeInTheDocument()
    expect(screen.getAllByText('pending').length).toBeGreaterThan(0)
    expect(screen.getByText('1 record for this user.')).toBeInTheDocument()
    expect(document.querySelector('time[datetime="2026-08-22T14:44:10.949Z"]')).not.toBeNull()
  })

  it('colors pending, success, and failure statuses', async () => {
    listedSendings = [
      {
        id: '1',
        createdAt: '2026-08-22T14:44:10.949Z',
        userId: '7',
        status: 'pending',
        failureMessage: null,
        recipientAddress: RECIPIENT,
        amount: '1',
        symbol: 'ETH',
      },
      {
        id: '2',
        createdAt: '2026-08-22T14:44:10.949Z',
        userId: '7',
        status: 'success',
        failureMessage: null,
        recipientAddress: RECIPIENT,
        amount: '1',
        symbol: 'ETH',
      },
      {
        id: '3',
        createdAt: '2026-08-22T14:44:10.949Z',
        userId: '7',
        status: 'failure',
        failureMessage: 'rejected',
        recipientAddress: RECIPIENT,
        amount: '1',
        symbol: 'ETH',
      },
    ]
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    openPath('/admin/users/7?tab=sendings')
    renderAdmin()

    await screen.findByRole('heading', { name: 'Sendings' })

    const pending = (await screen.findAllByText('pending'))[0]
    const success = screen.getByText('success')
    const failure = screen.getByText('failure')

    expect(pending?.className).toMatch(/risk-medium|warning/u)
    expect(success.className).toMatch(/risk-low/u)
    expect(failure.className).toMatch(/destructive/u)
    expect(screen.getByText(/rejected/)).toBeInTheDocument()
  })

  it('saves a sending edit via PATCH and sends status with failureMessage', async () => {
    listedSendings = [
      {
        id: '62',
        createdAt: '2026-08-22T14:59:14.037Z',
        userId: '7',
        status: 'pending',
        failureMessage: null,
        recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        amount: '4',
        symbol: 'ETH',
      },
    ]

    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    openPath('/admin/users/7?tab=sendings')
    renderAdmin()

    await user.click(await screen.findByRole('button', { name: /^Edit$/ }))

    expect(await screen.findByRole('heading', { name: 'Edit sending' })).toBeInTheDocument()
    expect(screen.getAllByText('james@example.com').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Failure reason')).toBeDisabled()
    expect(screen.getByLabelText('Failure reason').className).not.toMatch(/text-destructive/u)
    expect(screen.getByText('Failure reason')).not.toHaveClass('text-destructive')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(screen.getByLabelText('Asset')).toHaveTextContent('ETH')
    await user.click(screen.getByLabelText('Asset'))
    expect(screen.getByRole('option', { name: 'Select ETH on Ethereum' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('option', { name: 'Select USDC on Ethereum' })).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'Select USDC on Ethereum' }))
    await user.click(screen.getByLabelText('Status'))
    await user.click(screen.getByRole('option', { name: 'failure' }))
    expect(screen.getByLabelText('Status').className).toMatch(/text-destructive/u)
    expect(screen.getByText('Status')).toHaveClass('text-destructive')
    expect(screen.getByLabelText('Failure reason')).toBeEnabled()
    expect(screen.getByLabelText('Failure reason').className).toMatch(/text-destructive/u)
    expect(screen.getByText('Failure reason')).toHaveClass('text-destructive')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.click(screen.getByLabelText('Failure reason'))
    expect(screen.getByRole('option', { name: 'Insufficient balance' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Custom…' })).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'Blocked by admin' }))
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      const patch = fetchSpy.mock.calls.find((call) => {
        const url = requestUrl(call[0] as RequestInfo | URL)
        const method = call[1]?.method ?? 'GET'

        return url.endsWith('/v1/admin/sendings/62') && method === 'PATCH'
      })

      expect(patch).toBeDefined()
      expect(requestJson(patch?.[1])).toMatchObject({
        status: 'failure',
        failureMessage: 'Blocked by admin',
        recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        amount: '4',
        symbol: 'USDC',
        assetChainId: '1',
        assetStandard: 'ERC-20',
        assetAddress: USDC_TOKEN.address,
        assetName: 'USD Coin',
        assetDecimals: 6,
        assetIsVerified: true,
      })
    })
  })

  it('deletes a sending after confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    listedSendings = [
      {
        id: '62',
        createdAt: '2026-08-22T14:59:14.037Z',
        userId: '7',
        status: 'pending',
        failureMessage: null,
        recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        amount: '4',
        symbol: 'ETH',
      },
    ]

    try {
      const user = userEvent.setup()
      localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
      openPath('/admin/users/7?tab=sendings')
      renderAdmin()

      await user.click(await screen.findByRole('button', { name: /^Edit$/ }))
      await screen.findByRole('heading', { name: 'Edit sending' })
      await user.click(screen.getByRole('button', { name: 'Delete' }))

      expect(confirm).toHaveBeenCalledWith('Delete this sending? This cannot be undone.')
      await waitFor(() => {
        const removed = fetchSpy.mock.calls.find((call) => {
          const url = requestUrl(call[0] as RequestInfo | URL)
          const method = call[1]?.method ?? 'GET'

          return url.endsWith('/v1/admin/sendings/62') && method === 'DELETE'
        })

        expect(removed).toBeDefined()
      })
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Edit sending' })).not.toBeInTheDocument()
      })
      expect(screen.queryByText('id 62')).not.toBeInTheDocument()
    } finally {
      confirm.mockRestore()
    }
  })

  it('keeps the sending when delete confirmation is cancelled', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    listedSendings = [
      {
        id: '62',
        createdAt: '2026-08-22T14:59:14.037Z',
        userId: '7',
        status: 'pending',
        failureMessage: null,
        recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        amount: '4',
        symbol: 'ETH',
      },
    ]

    try {
      const user = userEvent.setup()
      localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
      openPath('/admin/users/7?tab=sendings')
      renderAdmin()

      await user.click(await screen.findByRole('button', { name: /^Edit$/ }))
      await screen.findByRole('heading', { name: 'Edit sending' })
      await user.click(screen.getByRole('button', { name: 'Delete' }))

      expect(confirm).toHaveBeenCalledOnce()
      expect(fetchSpy.mock.calls.some((call) => (call[1]?.method ?? 'GET') === 'DELETE')).toBe(
        false,
      )
      expect(screen.getByRole('heading', { name: 'Edit sending' })).toBeInTheDocument()
    } finally {
      confirm.mockRestore()
    }
  })

  it('deletes a receiving after confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    listedReceivings = [
      {
        id: '81',
        createdAt: '2026-08-22T15:10:00.000Z',
        userId: '7',
        status: 'pending',
        failureMessage: null,
        recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        amount: '12',
        symbol: 'USDC',
        usdAmount: '12.00',
      },
    ]

    try {
      const user = userEvent.setup()
      localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
      openPath('/admin/users/7?tab=receivings')
      renderAdmin()

      await user.click(await screen.findByRole('button', { name: /^Edit$/ }))
      await screen.findByRole('heading', { name: 'Edit receiving' })
      await user.click(screen.getByRole('button', { name: 'Delete' }))

      expect(confirm).toHaveBeenCalledWith('Delete this receiving? This cannot be undone.')
      await waitFor(() => {
        const removed = fetchSpy.mock.calls.find((call) => {
          const url = requestUrl(call[0] as RequestInfo | URL)
          const method = call[1]?.method ?? 'GET'

          return url.endsWith('/v1/admin/receivings/81') && method === 'DELETE'
        })

        expect(removed).toBeDefined()
      })
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Edit receiving' })).not.toBeInTheDocument()
      })
    } finally {
      confirm.mockRestore()
    }
  })

  it('lets the admin write a custom rejection reason via Custom', async () => {
    listedSendings = [
      {
        id: '62',
        createdAt: '2026-08-22T14:59:14.037Z',
        userId: '7',
        status: 'pending',
        failureMessage: null,
        recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        amount: '4',
        symbol: 'ETH',
      },
    ]

    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    openPath('/admin/users/7?tab=sendings')
    renderAdmin()

    await user.click(await screen.findByRole('button', { name: /^Edit$/ }))
    await screen.findByRole('heading', { name: 'Edit sending' })

    await user.click(screen.getByLabelText('Status'))
    await user.click(screen.getByRole('option', { name: 'failure' }))
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.click(screen.getByLabelText('Failure reason'))
    await user.click(screen.getByRole('option', { name: 'Custom…' }))
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.type(screen.getByLabelText('Custom failure message'), 'Node timed out')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      const patch = fetchSpy.mock.calls.find((call) => {
        const url = requestUrl(call[0] as RequestInfo | URL)
        const method = call[1]?.method ?? 'GET'

        return url.endsWith('/v1/admin/sendings/62') && method === 'PATCH'
      })

      expect(requestJson(patch?.[1])).toMatchObject({
        status: 'failure',
        failureMessage: 'Node timed out',
      })
    })
  })

  it('lets the admin write a custom receiving failure reason', async () => {
    listedReceivings = [
      {
        id: '81',
        createdAt: '2026-08-22T15:10:00.000Z',
        userId: '7',
        status: 'failure',
        failureMessage: 'Chargeback opened on this deposit',
        recipientAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        amount: '12',
        symbol: 'USDC',
        usdAmount: '12.00',
      },
    ]

    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    openPath('/admin/users/7?tab=receivings')
    renderAdmin()

    await user.click(await screen.findByRole('button', { name: /^Edit$/ }))
    await screen.findByRole('heading', { name: 'Edit receiving' })
    expect(screen.getByLabelText('Asset')).toHaveTextContent('USDC')

    expect(screen.getByLabelText('Failure reason')).toHaveTextContent('Custom…')
    const custom = screen.getByLabelText('Custom failure message')
    expect(custom).toHaveValue('Chargeback opened on this deposit')
    await user.clear(custom)
    await user.type(custom, 'Bank reversed the wire')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      const patch = fetchSpy.mock.calls.find((call) => {
        const url = requestUrl(call[0] as RequestInfo | URL)
        const method = call[1]?.method ?? 'GET'

        return url.endsWith('/v1/admin/receivings/81') && method === 'PATCH'
      })

      expect(requestJson(patch?.[1])).toMatchObject({
        status: 'failure',
        failureMessage: 'Bank reversed the wire',
        symbol: 'USDC',
        assetChainId: '1',
        assetStandard: 'ERC-20',
        assetAddress: USDC_TOKEN.address,
        assetName: 'USD Coin',
        assetDecimals: 6,
        assetIsVerified: true,
      })
    })
  })

  it('refreshes visible profile assets after a pending sending settles', async () => {
    let settled = false
    listedSendings = [{ ...PENDING_SENDING, userId: '7' }]
    const previous = fetchSpy.getMockImplementation()

    fetchSpy.mockImplementation((input, init) => {
      const url = requestUrl(input)
      const method = init?.method ?? 'GET'

      if (url.endsWith('/v1/admin/users/7') && method === 'GET') {
        const assets = settled
          ? {
              ...USER.assets,
              tokens: [{ ...ETH_TOKEN, balance: '1000000000000000000' }, USDC_TOKEN],
            }
          : USER.assets

        return Promise.resolve(jsonResponse(200, { ...USER, assets }))
      }

      if (url.endsWith('/v1/admin/sendings/61') && method === 'PATCH') {
        settled = true
        const body = requestJson(init) as Record<string, unknown>

        return Promise.resolve(
          jsonResponse(200, {
            ...PENDING_SENDING,
            userId: '7',
            ...body,
            settledAt: '2026-09-10T12:00:00.000Z',
          }),
        )
      }

      return previous?.(input, init) ?? Promise.resolve(jsonResponse(404, {}))
    })

    const user = userEvent.setup()
    openPath('/admin/users/7')
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    renderAdmin()

    expect(await screen.findByRole('heading', { name: 'james@example.com' })).toBeInTheDocument()
    expect(await screen.findByText('≈ $6,568.24')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Sendings' }))
    await user.click(await screen.findByRole('button', { name: /^Edit$/ }))
    await user.click(screen.getByLabelText('Status'))
    await user.click(screen.getByRole('option', { name: 'success' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await user.click(screen.getByRole('button', { name: 'Assets' }))

    expect(await screen.findByText('≈ $3,284.12')).toBeInTheDocument()
  })

  it('shows a toast for a new pending request on any cabinet tab', async () => {
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    renderAdmin()

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument()

    const source = await openedActivityRequestStream()
    expect(source.url).toBe('/v1/admin/activity-requests/stream')

    source.emit('activity-requests', JSON.stringify(activityRequestFrame()))

    expect(await screen.findByRole('alert')).toHaveTextContent('Pending sending request')
    expect(screen.getByRole('alert')).toHaveTextContent('0.01 ETH')
    expect(screen.getByRole('alert')).toHaveTextContent('Alex · User james@example.com')
    expect(screen.getByRole('alert').className).toMatch(/bg-card/u)
    expect(screen.getByText(/^pending$/i).className).toMatch(/request-warning/u)
    const handle = screen.getByRole('button', { name: 'Handle Pending sending request 0.01 ETH' })
    expect(handle).toBeInTheDocument()
    expect(handle.className).toMatch(/h-16/u)

    await user.click(handle)

    expect(await screen.findByRole('heading', { name: 'Alex' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('immediately shows pending requests already in the directory', async () => {
    listedActivityRequests = [{ ...PENDING_ACTIVITY_REQUEST }]
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    renderAdmin()

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Pending sending request')
    expect(screen.getByRole('alert')).toHaveTextContent('0.01 ETH')
    expect(
      screen.getByRole('button', { name: 'Handle Pending sending request 0.01 ETH' }),
    ).toBeInTheDocument()
  })

  it('does not toast a pending sending as an activity request', async () => {
    listedSendings = [PENDING_SENDING]
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    renderAdmin()

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument()
    await openedActivityRequestStream()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('collapses a queue longer than three cards into a list link', async () => {
    listedActivityRequests = [1, 2, 3, 4].map((index) => ({
      ...PENDING_ACTIVITY_REQUEST,
      id: `ar-${String(index)}`,
      createdAt: `2026-09-12T12:0${String(index)}:00.000Z`,
      amount: String(index),
    }))
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    renderAdmin()

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument()
    expect(await screen.findAllByRole('alert')).toHaveLength(3)
    expect(screen.getByRole('link', { name: '1 more request' })).toHaveAttribute(
      'href',
      '/admin/requests',
    )
  })

  it('toasts approved, rejected, and cancelled requests without Handle', async () => {
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    renderAdmin()

    await screen.findByRole('heading', { name: 'Users' })
    const source = await openedActivityRequestStream()

    source.emit(
      'activity-requests',
      JSON.stringify(
        activityRequestFrame({
          id: 'ar-approved',
          createdAt: '2026-09-12T12:03:00.000Z',
          requestStatus: 'approved',
          amount: '1',
        }),
      ),
    )
    source.emit(
      'activity-requests',
      JSON.stringify(
        activityRequestFrame({
          id: 'ar-rejected',
          createdAt: '2026-09-12T12:02:00.000Z',
          requestStatus: 'rejected',
          amount: '2',
        }),
      ),
    )
    source.emit(
      'activity-requests',
      JSON.stringify(
        activityRequestFrame({
          id: 'ar-cancelled',
          createdAt: '2026-09-12T12:01:00.000Z',
          requestStatus: 'cancelled',
          amount: '3',
        }),
      ),
    )

    const alerts = await screen.findAllByRole('alert')
    expect(alerts).toHaveLength(3)
    expect(alerts[0]).toHaveTextContent('Sending request approved')
    expect(alerts[0]?.className).toMatch(/bg-card/u)
    expect(within(alerts[0]!).getByText(/^approved$/i).className).toMatch(/request-success/u)
    expect(alerts[1]).toHaveTextContent('Sending request rejected')
    expect(within(alerts[1]!).getByText(/^rejected$/i).className).toMatch(/request-danger/u)
    expect(alerts[2]).toHaveTextContent('Sending request cancelled')
    expect(within(alerts[2]!).getByText(/^cancelled$/i).className).toMatch(/muted/u)
    expect(screen.queryByRole('button', { name: /Handle/ })).not.toBeInTheDocument()
  })

  it('toasts a receiving request and replaces pending with the later status', async () => {
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    renderAdmin()

    await screen.findByRole('heading', { name: 'Users' })
    const source = await openedActivityRequestStream()

    source.emit(
      'activity-requests',
      JSON.stringify(
        activityRequestFrame({
          kind: 'receiving',
          recipientAddress: null,
        }),
      ),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Awaiting receiving request')
    expect(
      screen.getByRole('button', { name: 'Handle Awaiting receiving request 0.01 ETH' }),
    ).toBeInTheDocument()

    source.emit(
      'activity-requests',
      JSON.stringify(
        activityRequestFrame({
          kind: 'receiving',
          requestStatus: 'approved',
          type_request: 'update',
          recipientAddress: null,
        }),
      ),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Receiving request approved')
    expect(screen.queryByRole('button', { name: /Handle/ })).not.toBeInTheDocument()
  })

  it('a request toast can be dismissed without opening Handle', async () => {
    const user = userEvent.setup()
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '9100')
    renderAdmin()

    await screen.findByRole('heading', { name: 'Users' })
    const source = await openedActivityRequestStream()
    source.emit('activity-requests', JSON.stringify(activityRequestFrame()))

    expect(await screen.findByRole('alert')).toBeInTheDocument()

    const close = screen.getByRole('button', { name: 'Dismiss Pending sending request' })
    expect(close).toHaveClass('cursor-pointer')
    await user.click(close)

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    source.emit(
      'activity-requests',
      JSON.stringify(activityRequestFrame({ amount: '3', type_request: 'update' })),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Updated sending request')
    expect(screen.getByRole('alert')).toHaveTextContent('3 ETH')
    expect(
      screen.getByRole('button', { name: 'Handle Updated sending request 3 ETH' }),
    ).toBeInTheDocument()
  })

  it('toasts only Super approve or reject of the signed-in admin name', async () => {
    localStorage.setItem(ADMIN_PIN_STORAGE_KEY, '4200')
    localStorage.setItem(ADMIN_NAME_STORAGE_KEY, 'Alex')
    renderAdmin()

    await screen.findByRole('heading', { name: 'Users' })
    const source = await openedActivityRequestStream()

    source.emit(
      'activity-requests',
      JSON.stringify(
        activityRequestFrame({
          kind: 'receiving',
          recipientAddress: null,
        }),
      ),
    )
    source.emit(
      'activity-requests',
      JSON.stringify(
        activityRequestFrame({
          id: 'ar-maria',
          kind: 'receiving',
          requestStatus: 'approved',
          requestedByName: 'Maria',
          recipientAddress: null,
        }),
      ),
    )
    source.emit(
      'activity-requests',
      JSON.stringify(
        activityRequestFrame({
          id: 'ar-cancelled',
          kind: 'receiving',
          requestStatus: 'cancelled',
          recipientAddress: null,
        }),
      ),
    )
    source.emit(
      'activity-requests',
      JSON.stringify(
        activityRequestFrame({
          id: 'ar-alex-approved',
          kind: 'receiving',
          requestStatus: 'approved',
          type_request: 'update',
          recipientAddress: null,
        }),
      ),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Receiving request approved')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.queryByText('Awaiting receiving request')).not.toBeInTheDocument()
    expect(screen.queryByText('Receiving request cancelled')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Alex · User james@example.com')
    expect(screen.getByRole('alert').className).toMatch(/bg-card/u)
    expect(screen.getByText(/^approved$/i).className).toMatch(/request-success/u)
    expect(screen.queryByRole('button', { name: /Handle/ })).not.toBeInTheDocument()

    source.emit(
      'activity-requests',
      JSON.stringify(
        activityRequestFrame({
          id: 'ar-alex-rejected',
          kind: 'receiving',
          requestStatus: 'rejected',
          requestedByName: ' alex ',
          recipientAddress: null,
        }),
      ),
    )

    await waitFor(() => {
      expect(screen.getAllByRole('alert')).toHaveLength(2)
    })
    const alerts = screen.getAllByRole('alert')
    expect(alerts[0]).toHaveTextContent('Receiving request rejected')
    expect(within(alerts[0]!).getByText(/^rejected$/i).className).toMatch(/request-danger/u)
    expect(alerts[1]).toHaveTextContent('Receiving request approved')
    expect(screen.queryByRole('button', { name: /Handle/ })).not.toBeInTheDocument()
  })
})
