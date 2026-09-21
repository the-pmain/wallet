import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { buildApp } from '../app.ts'
import { RUNTIME_MODE, type IServerConfig } from '../config.ts'
import { ASSET_STANDARD } from '../users/assets.ts'
import { MemoryUsersRepository } from '../users/MemoryUsersRepository.ts'

process.env['ADMIN_PASS'] = '4200'
process.env['SUPER_ADMIN_PASS'] = '9100'

const CONFIG: IServerConfig = {
  mode: RUNTIME_MODE.Test,
  host: '127.0.0.1',
  port: 0,
  allowedOrigins: [],
  allowedAddresses: [],
  rateLimit: { max: 10_000, windowMs: 60_000 },
  maxBodyBytes: 64 * 1024,
  catalogCacheSeconds: 300,
  supabaseUrl: null,
  supabaseAnonKey: null,
  supabasePublishableKey: null,
  supabaseServiceRoleKey: null,
  staticRoot: null,
  cloudflareAccountId: null,
  cloudflareApiToken: null,
  cloudflareAuthEmail: null,
  mailFrom: 'support@etwalletx.com',
  r2AccessKeyId: null,
  r2SecretAccessKey: null,
  r2Endpoint: null,
  r2Bucket: null,
  emailWebhookSecret: 'webhook-secret',
  adminPass: null,
  superAdminPass: null,
}

const RECIPIENT = '0x6B175474E89094C44Da98b954EedeAC495271d0F'

const ETH = {
  assetChainId: '1',
  assetStandard: 'native',
  assetAddress: null,
  assetName: 'Ether',
  assetDecimals: 18,
  assetIsVerified: true,
}

describe('activity request routes', () => {
  let app: FastifyInstance
  let users: MemoryUsersRepository
  let userId: string

  beforeEach(async () => {
    users = new MemoryUsersRepository()
    const user = await users.create({
      email: 'james@example.com',
      balance: '0',
      theP: 'demo',
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
    userId = user.id
    app = await buildApp({ config: CONFIG, users })
  })

  afterEach(async () => {
    await app.close()
  })

  it('lets a read password submit a sending request without creating a sending', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/admin/activity-requests',
      headers: { 'x-admin-pass': '4200' },
      payload: {
        kind: 'sending',
        requestedByName: 'Alex',
        userId,
        recipientAddress: RECIPIENT,
        amount: '0.01',
        symbol: 'ETH',
        ...ETH,
      },
    })

    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      kind: 'sending',
      requestStatus: 'pending',
      requestedByName: 'Alex',
      createdSendingId: null,
      amount: '0.01',
    })

    const sendings = await app.inject({
      method: 'GET',
      url: '/v1/admin/sendings',
      headers: { 'x-admin-pass': '4200' },
    })

    expect(sendings.json<{ sendings: unknown[] }>().sendings).toHaveLength(0)
  })

  it('links a sending request to an existing sending and updates it on approve', async () => {
    const sending = await app.inject({
      method: 'POST',
      url: '/v1/admin/sendings',
      headers: { 'x-admin-pass': '9100' },
      payload: {
        userId,
        recipientAddress: RECIPIENT,
        amount: '0.5',
        symbol: 'ETH',
        status: 'pending',
        ...ETH,
      },
    })

    expect(sending.statusCode).toBe(201)
    const sendingId = sending.json<{ id: string }>().id

    const created = await app.inject({
      method: 'POST',
      url: '/v1/admin/activity-requests',
      headers: { 'x-admin-pass': '4200' },
      payload: {
        kind: 'sending',
        requestedByName: 'Alex',
        userId,
        recipientAddress: RECIPIENT,
        amount: '0.4',
        symbol: 'ETH',
        transferStatus: 'success',
        createdSendingId: sendingId,
        ...ETH,
      },
    })

    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({ createdSendingId: sendingId })

    const approved = await app.inject({
      method: 'POST',
      url: `/v1/admin/activity-requests/${created.json<{ id: string }>().id}/approve`,
      headers: { 'x-admin-pass': '9100' },
      payload: {},
    })

    expect(approved.statusCode).toBe(200)
    expect(approved.json()).toMatchObject({ createdSendingId: sendingId })

    const listed = await app.inject({
      method: 'GET',
      url: '/v1/admin/sendings',
      headers: { 'x-admin-pass': '4200' },
    })

    expect(listed.json<{ sendings: { id: string; amount: string }[] }>().sendings).toEqual([
      expect.objectContaining({ id: sendingId, amount: '0.4' }),
    ])
  })

  it('opens or creates a request for a sending id', async () => {
    const sending = await app.inject({
      method: 'POST',
      url: '/v1/admin/sendings',
      headers: { 'x-admin-pass': '9100' },
      payload: {
        userId,
        recipientAddress: RECIPIENT,
        amount: '0.5',
        symbol: 'ETH',
        status: 'pending',
        ...ETH,
      },
    })

    expect(sending.statusCode).toBe(201)
    const sendingId = sending.json<{ id: string }>().id

    const created = await app.inject({
      method: 'POST',
      url: '/v1/admin/activity-requests/for-sending',
      headers: { 'x-admin-pass': '4200' },
      payload: {
        sendingId,
        requestedByName: 'Alex',
      },
    })

    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      createdSendingId: sendingId,
      requestedByName: 'Alex',
      amount: '0.5',
    })

    const reused = await app.inject({
      method: 'POST',
      url: '/v1/admin/activity-requests/for-sending',
      headers: { 'x-admin-pass': '4200' },
      payload: {
        sendingId,
        requestedByName: 'Alex',
      },
    })

    expect(reused.statusCode).toBe(200)
    expect(reused.json()).toMatchObject({
      id: created.json<{ id: string }>().id,
      createdSendingId: sendingId,
    })
  })

  it('opens or creates a request for an existing receiving', async () => {
    const receiving = await app.inject({
      method: 'POST',
      url: '/v1/admin/receivings',
      headers: { 'x-admin-pass': '9100' },
      payload: {
        userId,
        amount: '0.5',
        symbol: 'ETH',
        status: 'pending',
        ...ETH,
      },
    })

    expect(receiving.statusCode).toBe(201)
    const receivingId = receiving.json<{ id: string }>().id

    const created = await app.inject({
      method: 'POST',
      url: '/v1/admin/activity-requests/for-receiving',
      headers: { 'x-admin-pass': '4200' },
      payload: {
        receivingId,
        requestedByName: 'Alex',
      },
    })

    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      createdReceivingId: receivingId,
      requestedByName: 'Alex',
      amount: '0.5',
    })

    const reused = await app.inject({
      method: 'POST',
      url: '/v1/admin/activity-requests/for-receiving',
      headers: { 'x-admin-pass': '4200' },
      payload: {
        receivingId,
        requestedByName: 'Alex',
      },
    })

    expect(reused.statusCode).toBe(200)
    expect(reused.json()).toMatchObject({
      id: created.json<{ id: string }>().id,
      createdReceivingId: receivingId,
    })
  })

  it('refuses a sending request larger than the user holding', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/admin/activity-requests',
      headers: { 'x-admin-pass': '4200' },
      payload: {
        kind: 'sending',
        requestedByName: 'Alex',
        userId,
        recipientAddress: RECIPIENT,
        amount: '3',
        symbol: 'ETH',
        ...ETH,
      },
    })

    expect(created.statusCode).toBe(400)
    expect(created.json()).toMatchObject({
      error: { code: 'invalid_request', message: 'Insufficient ETH balance.' },
    })
  })

  it('does not let a read password approve', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/admin/activity-requests',
      headers: { 'x-admin-pass': '4200' },
      payload: {
        kind: 'receiving',
        requestedByName: 'Alex',
        userId,
        amount: '1',
        symbol: 'ETH',
        ...ETH,
      },
    })

    const approved = await app.inject({
      method: 'POST',
      url: `/v1/admin/activity-requests/${created.json<{ id: string }>().id}/approve`,
      headers: { 'x-admin-pass': '4200' },
      payload: {},
    })

    expect(approved.statusCode).toBe(403)
  })

  it('lets a super PIN approve and publish a sending', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/admin/activity-requests',
      headers: { 'x-admin-pass': '4200' },
      payload: {
        kind: 'sending',
        requestedByName: 'Alex',
        userId,
        recipientAddress: RECIPIENT,
        amount: '0.01',
        symbol: 'ETH',
        ...ETH,
      },
    })

    const id = created.json<{ id: string }>().id
    const approved = await app.inject({
      method: 'POST',
      url: `/v1/admin/activity-requests/${id}/approve`,
      headers: { 'x-admin-pass': '9100' },
      payload: {},
    })

    expect(approved.statusCode).toBe(200)
    expect(approved.json()).toMatchObject({
      requestStatus: 'approved',
      createdSendingId: expect.any(String),
    })

    const sendings = await app.inject({
      method: 'GET',
      url: '/v1/admin/sendings',
      headers: { 'x-admin-pass': '9100' },
    })

    expect(sendings.json<{ sendings: { amount: string }[] }>().sendings[0]?.amount).toBe('0.01')
  })

  it('does not let a read password cancel a request', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/admin/activity-requests',
      headers: { 'x-admin-pass': '4200' },
      payload: {
        kind: 'receiving',
        requestedByName: 'Alex',
        userId,
        amount: '1',
        symbol: 'ETH',
        ...ETH,
      },
    })

    const id = created.json<{ id: string }>().id
    const cancelled = await app.inject({
      method: 'POST',
      url: `/v1/admin/activity-requests/${id}/cancel`,
      headers: { 'x-admin-pass': '4200' },
      payload: { reviewedByName: 'Alex' },
    })

    expect(cancelled.statusCode).toBe(403)
  })

  it('lets a read password patch a pending request', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/admin/activity-requests',
      headers: { 'x-admin-pass': '4200' },
      payload: {
        kind: 'receiving',
        requestedByName: 'Alex',
        userId,
        amount: '1',
        symbol: 'ETH',
        ...ETH,
      },
    })

    const id = created.json<{ id: string }>().id
    const patched = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/activity-requests/${id}`,
      headers: { 'x-admin-pass': '4200' },
      payload: {
        kind: 'receiving',
        amount: '2',
        symbol: 'ETH',
        ...ETH,
      },
    })

    expect(patched.statusCode).toBe(200)
    expect(patched.json()).toMatchObject({
      id,
      requestStatus: 'pending',
      amount: '2',
    })
  })

  it('lets a read password reopen an approved request for Super Admin review', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/admin/activity-requests',
      headers: { 'x-admin-pass': '4200' },
      payload: {
        kind: 'receiving',
        requestedByName: 'Alex',
        userId,
        amount: '12000',
        symbol: 'ETH',
        usdAmount: '1199.76',
        ...ETH,
      },
    })

    const id = created.json<{ id: string }>().id
    const approved = await app.inject({
      method: 'POST',
      url: `/v1/admin/activity-requests/${id}/approve`,
      headers: { 'x-admin-pass': '9100' },
      payload: {},
    })

    expect(approved.statusCode).toBe(200)
    expect(approved.json()).toMatchObject({ id, requestStatus: 'approved' })

    const patched = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/activity-requests/${id}`,
      headers: { 'x-admin-pass': '4200' },
      payload: {
        kind: 'receiving',
        amount: '13000',
        symbol: 'ETH',
        usdAmount: '1300',
        ...ETH,
      },
    })

    expect(patched.statusCode).toBe(200)
    expect(patched.json()).toMatchObject({
      id,
      requestStatus: 'pending',
      amount: '13000',
      createdReceivingId: approved.json<{ createdReceivingId: string }>().createdReceivingId,
    })
  })

  it('lets a super PIN patch a pending request', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/admin/activity-requests',
      headers: { 'x-admin-pass': '4200' },
      payload: {
        kind: 'sending',
        requestedByName: 'Alex',
        userId,
        recipientAddress: RECIPIENT,
        amount: '0.01',
        symbol: 'ETH',
        ...ETH,
      },
    })

    const id = created.json<{ id: string }>().id
    const patched = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/activity-requests/${id}`,
      headers: { 'x-admin-pass': '9100' },
      payload: {
        kind: 'sending',
        recipientAddress: RECIPIENT,
        amount: '1.5',
        symbol: 'ETH',
        transferStatus: 'success',
        ...ETH,
      },
    })

    expect(patched.statusCode).toBe(200)
    expect(patched.json()).toMatchObject({
      id,
      requestStatus: 'pending',
      requestedByName: 'Alex',
      amount: '1.5',
      transferStatus: 'success',
    })
  })

  it('pages activity requests from the directory with joined email', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/admin/activity-requests',
      headers: { 'x-admin-pass': '4200' },
      payload: {
        kind: 'sending',
        requestedByName: 'Alex',
        userId,
        recipientAddress: RECIPIENT,
        amount: '1.5',
        symbol: 'ETH',
        ...ETH,
      },
    })

    const page = await app.inject({
      method: 'GET',
      url: '/v1/admin/directory/activity-requests?q=alex',
      headers: { 'x-admin-pass': '4200' },
    })

    expect(page.statusCode).toBe(200)
    expect(page.json()).toMatchObject({
      total: 1,
      page: 1,
      items: [
        {
          userEmail: 'james@example.com',
          requestedByName: 'Alex',
          amount: '1.5',
        },
      ],
    })
  })

  it('GET /v1/admin/activity-requests/stream holds the stream and yields a create frame', async () => {
    const address = await app.listen({ host: '127.0.0.1', port: 0 })
    const controller = new AbortController()
    const stream = await fetch(`${address}/v1/admin/activity-requests/stream`, {
      headers: { Accept: 'text/event-stream', 'x-admin-pass': '9100' },
      signal: controller.signal,
    })

    expect(stream.status).toBe(200)
    expect(stream.headers.get('content-type')).toMatch(/text\/event-stream/i)

    const reader = stream.body?.getReader()
    expect(reader).toBeDefined()

    const decoder = new TextDecoder()
    const chunks: string[] = []
    const reading = (async () => {
      if (reader === undefined) {
        return
      }

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        chunks.push(decoder.decode(value, { stream: true }))

        if (chunks.join('').includes('type_request')) {
          break
        }
      }
    })()

    const created = await app.inject({
      method: 'POST',
      url: '/v1/admin/activity-requests',
      headers: { 'x-admin-pass': '4200' },
      payload: {
        kind: 'sending',
        requestedByName: 'Alex',
        userId,
        recipientAddress: RECIPIENT,
        amount: '0.01',
        symbol: 'ETH',
        ...ETH,
      },
    })

    expect(created.statusCode).toBe(201)
    await reading

    controller.abort()

    const body = chunks.join('')
    expect(body).toContain('event: activity-requests')
    expect(body).toContain('"type_request":"create"')
    expect(body).toContain('"requestStatus":"pending"')
    expect(body).toContain(`"userId":"${userId}"`)
    expect(body).toContain('"userEmail":"james@example.com"')
  })

  it('GET /v1/admin/activity-requests/stream yields an update after approve', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/admin/activity-requests',
      headers: { 'x-admin-pass': '4200' },
      payload: {
        kind: 'sending',
        requestedByName: 'Alex',
        userId,
        recipientAddress: RECIPIENT,
        amount: '0.01',
        symbol: 'ETH',
        ...ETH,
      },
    })
    const id = created.json<{ id: string }>().id
    const address = await app.listen({ host: '127.0.0.1', port: 0 })
    const controller = new AbortController()
    const stream = await fetch(`${address}/v1/admin/activity-requests/stream`, {
      headers: { Accept: 'text/event-stream', 'x-admin-pass': '9100' },
      signal: controller.signal,
    })

    expect(stream.status).toBe(200)

    const reader = stream.body?.getReader()
    expect(reader).toBeDefined()

    const decoder = new TextDecoder()
    const chunks: string[] = []
    const reading = (async () => {
      if (reader === undefined) {
        return
      }

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        chunks.push(decoder.decode(value, { stream: true }))

        if (chunks.join('').includes('"type_request":"update"')) {
          break
        }
      }
    })()

    const approved = await app.inject({
      method: 'POST',
      url: `/v1/admin/activity-requests/${id}/approve`,
      headers: { 'x-admin-pass': '9100' },
      payload: {},
    })

    expect(approved.statusCode).toBe(200)
    await reading

    controller.abort()

    const body = chunks.join('')
    expect(body).toContain('event: activity-requests')
    expect(body).toContain('"type_request":"update"')
    expect(body).toContain('"requestStatus":"approved"')
  })

  it('GET /v1/admin/activity-requests/stream yields an update after a patch', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/admin/activity-requests',
      headers: { 'x-admin-pass': '4200' },
      payload: {
        kind: 'sending',
        requestedByName: 'Alex',
        userId,
        recipientAddress: RECIPIENT,
        amount: '0.01',
        symbol: 'ETH',
        ...ETH,
      },
    })
    const id = created.json<{ id: string }>().id
    const address = await app.listen({ host: '127.0.0.1', port: 0 })
    const controller = new AbortController()
    const stream = await fetch(`${address}/v1/admin/activity-requests/stream`, {
      headers: { Accept: 'text/event-stream', 'x-admin-pass': '9100' },
      signal: controller.signal,
    })

    expect(stream.status).toBe(200)

    const reader = stream.body?.getReader()
    expect(reader).toBeDefined()

    const decoder = new TextDecoder()
    const chunks: string[] = []
    const reading = (async () => {
      if (reader === undefined) {
        return
      }

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        chunks.push(decoder.decode(value, { stream: true }))

        if (chunks.join('').includes('"type_request":"update"')) {
          break
        }
      }
    })()

    const patched = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/activity-requests/${id}`,
      headers: { 'x-admin-pass': '4200' },
      payload: {
        kind: 'sending',
        recipientAddress: RECIPIENT,
        amount: '1.5',
        symbol: 'ETH',
        ...ETH,
      },
    })

    expect(patched.statusCode).toBe(200)
    await reading

    controller.abort()

    const body = chunks.join('')
    expect(body).toContain('event: activity-requests')
    expect(body).toContain('"type_request":"update"')
    expect(body).toContain('"amount":"1.5"')
    expect(body).toContain('"requestStatus":"pending"')
  })

  it('does not list activity requests for a read password', async () => {
    const listed = await app.inject({
      method: 'GET',
      url: '/v1/admin/activity-requests',
      headers: { 'x-admin-pass': '4200' },
    })

    expect(listed.statusCode).toBe(403)
  })

  it('GET /v1/admin/activity-requests/stream yields an approve to a read password', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/admin/activity-requests',
      headers: { 'x-admin-pass': '4200' },
      payload: {
        kind: 'receiving',
        requestedByName: 'Alex',
        userId,
        recipientAddress: null,
        amount: '0.01',
        symbol: 'ETH',
        ...ETH,
      },
    })
    const id = created.json<{ id: string }>().id
    const address = await app.listen({ host: '127.0.0.1', port: 0 })
    const controller = new AbortController()
    const stream = await fetch(`${address}/v1/admin/activity-requests/stream`, {
      headers: { Accept: 'text/event-stream', 'x-admin-pass': '4200' },
      signal: controller.signal,
    })

    expect(stream.status).toBe(200)

    const reader = stream.body?.getReader()
    expect(reader).toBeDefined()

    const decoder = new TextDecoder()
    const chunks: string[] = []
    const reading = (async () => {
      if (reader === undefined) {
        return
      }

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        chunks.push(decoder.decode(value, { stream: true }))

        if (chunks.join('').includes('"type_request":"update"')) {
          break
        }
      }
    })()

    const approved = await app.inject({
      method: 'POST',
      url: `/v1/admin/activity-requests/${id}/approve`,
      headers: { 'x-admin-pass': '9100' },
      payload: {},
    })

    expect(approved.statusCode).toBe(200)
    await reading

    controller.abort()

    const body = chunks.join('')
    expect(body).toContain('event: activity-requests')
    expect(body).toContain('"type_request":"update"')
    expect(body).toContain('"requestStatus":"approved"')
    expect(body).toContain('"requestedByName":"Alex"')
    expect(body).toContain('"kind":"receiving"')
  })

  it('opens the activity-requests stream for a read password', async () => {
    const address = await app.listen({ host: '127.0.0.1', port: 0 })
    const stream = await fetch(`${address}/v1/admin/activity-requests/stream`, {
      headers: { Accept: 'text/event-stream', 'x-admin-pass': '4200' },
    })

    expect(stream.status).toBe(200)
    expect(stream.headers.get('content-type')).toMatch(/text\/event-stream/i)
    await stream.body?.cancel()
  })

  it('does not open the activity-requests stream without a cabinet password', async () => {
    const address = await app.listen({ host: '127.0.0.1', port: 0 })
    const denied = await fetch(`${address}/v1/admin/activity-requests/stream`, {
      headers: { Accept: 'text/event-stream' },
    })

    expect(denied.status).toBe(401)
  })
})
