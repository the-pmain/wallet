import type { FastifyInstance, FastifyRequest } from 'fastify'

import { requireAdminRole, requireSuperAdmin } from '../admin/access.ts'
import type { AdminDirectory } from '../admin/AdminDirectory.ts'
import {
  ActivityRequestsConflictError,
  ActivityRequestsForbiddenError,
  ActivityRequestsNotFoundError,
  ActivityRequestsValidationError,
  type ActivityRequestsService,
} from '../activity-requests/ActivityRequestsService.ts'
import {
  ActivityRequestsHub,
  formatActivityRequestsSseFrame,
} from '../activity-requests/ActivityRequestsHub.ts'
import { ACTIVITY_REQUEST_KIND } from '../activity-requests/kind.ts'
import { REQUESTED_BY_NAME_MAX_LENGTH } from '../activity-requests/name.ts'
import { ApiError, BadRequestError, ForbiddenError, NotFoundError } from '../lib/errors.ts'
import { RECIPIENT_ADDRESS_MAX_LENGTH, RECIPIENT_ADDRESS_MIN_LENGTH } from '../lib/crypto-wallet.ts'
import { API_CONTENT_SECURITY_POLICY } from '../lib/ui.ts'
import { SENDING_AMOUNT_JSON_PATTERN } from '../sendings/amount.ts'
import { SENDING_STATUS } from '../sendings/status.ts'
import { SENDING_SYMBOL_JSON_PATTERN } from '../sendings/symbol.ts'
import type { SendingsService } from '../sendings/SendingsService.ts'
import type { ReceivingsHub } from '../receivings/ReceivingsHub.ts'
import type { ReceivingsService } from '../receivings/ReceivingsService.ts'
import type { IActivityRequestRecord } from '../activity-requests/contracts.ts'
import type { IReceivingRecord } from '../receivings/contracts.ts'
import {
  ACTIVITY_REQUEST_SSE_TYPE,
  RECEIVING_SSE_TYPE,
  type ActivityRequestSseType,
  type IActivityRequestResponse,
  type IActivityRequestSseEvent,
  type IReceivingResponse,
} from './contracts.ts'

const ASSET_METADATA_PROPERTIES = {
  assetChainId: { type: 'string', minLength: 1, maxLength: 78, pattern: '^\\d+$' },
  assetStandard: { type: 'string', enum: ['native', 'ERC-20'] },
  assetAddress: { type: ['string', 'null'], maxLength: 42 },
  assetName: { type: 'string', minLength: 1, maxLength: 128 },
  assetDecimals: { type: 'integer', minimum: 0, maximum: 36 },
  assetIsVerified: { type: 'boolean' },
} as const

const CREATE_BODY = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'requestedByName', 'userId', 'amount', 'symbol'],
  properties: {
    kind: { type: 'string', enum: Object.values(ACTIVITY_REQUEST_KIND) },
    requestedByName: { type: 'string', minLength: 1, maxLength: REQUESTED_BY_NAME_MAX_LENGTH },
    userId: { type: 'string', minLength: 1, maxLength: 20, pattern: '^\\d+$' },
    transferStatus: { type: 'string', enum: Object.values(SENDING_STATUS) },
    failureMessage: { type: ['string', 'null'], maxLength: 500 },
    recipientAddress: {
      type: ['string', 'null'],
      minLength: RECIPIENT_ADDRESS_MIN_LENGTH,
      maxLength: RECIPIENT_ADDRESS_MAX_LENGTH,
    },
    amount: {
      type: 'string',
      minLength: 1,
      maxLength: 78,
      pattern: SENDING_AMOUNT_JSON_PATTERN,
    },
    symbol: {
      type: 'string',
      minLength: 1,
      maxLength: 16,
      pattern: SENDING_SYMBOL_JSON_PATTERN,
    },
    usdAmount: { type: ['string', 'null'], maxLength: 32 },
    createdSendingId: { type: ['string', 'null'], minLength: 1, maxLength: 20, pattern: '^\\d+$' },
    ...ASSET_METADATA_PROPERTIES,
  },
} as const

const FOR_SENDING_BODY = {
  type: 'object',
  additionalProperties: false,
  required: ['sendingId', 'requestedByName'],
  properties: {
    sendingId: { type: 'string', minLength: 1, maxLength: 20, pattern: '^\\d+$' },
    requestedByName: { type: 'string', minLength: 1, maxLength: REQUESTED_BY_NAME_MAX_LENGTH },
  },
} as const

const UPDATE_BODY = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'amount', 'symbol'],
  properties: {
    kind: { type: 'string', enum: Object.values(ACTIVITY_REQUEST_KIND) },
    transferStatus: { type: 'string', enum: Object.values(SENDING_STATUS) },
    failureMessage: { type: ['string', 'null'], maxLength: 500 },
    recipientAddress: {
      type: ['string', 'null'],
      minLength: RECIPIENT_ADDRESS_MIN_LENGTH,
      maxLength: RECIPIENT_ADDRESS_MAX_LENGTH,
    },
    amount: {
      type: 'string',
      minLength: 1,
      maxLength: 78,
      pattern: SENDING_AMOUNT_JSON_PATTERN,
    },
    symbol: {
      type: 'string',
      minLength: 1,
      maxLength: 16,
      pattern: SENDING_SYMBOL_JSON_PATTERN,
    },
    usdAmount: { type: ['string', 'null'], maxLength: 32 },
    ...ASSET_METADATA_PROPERTIES,
  },
} as const

const REVIEW_BODY = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reviewedByName: { type: ['string', 'null'], minLength: 1, maxLength: REQUESTED_BY_NAME_MAX_LENGTH },
    reviewMessage: { type: ['string', 'null'], maxLength: 500 },
  },
} as const

const REQUEST_ID_PARAMS = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 36, maxLength: 36 },
  },
} as const

const SSE_KEEPALIVE_MS = 30_000

interface IAssetMetadataBody {
  readonly assetChainId?: string
  readonly assetStandard?: 'native' | 'ERC-20'
  readonly assetAddress?: string | null
  readonly assetName?: string
  readonly assetDecimals?: number
  readonly assetIsVerified?: boolean
}

interface ICreateBody extends IAssetMetadataBody {
  readonly kind: 'sending' | 'receiving'
  readonly requestedByName: string
  readonly userId: string
  readonly transferStatus?: 'pending' | 'success' | 'failure'
  readonly failureMessage?: string | null
  readonly recipientAddress?: string | null
  readonly amount: string
  readonly symbol: string
  readonly usdAmount?: string | null
  readonly createdSendingId?: string | null
}

interface IUpdateBody extends IAssetMetadataBody {
  readonly kind: 'sending' | 'receiving'
  readonly transferStatus?: 'pending' | 'success' | 'failure'
  readonly failureMessage?: string | null
  readonly recipientAddress?: string | null
  readonly amount: string
  readonly symbol: string
  readonly usdAmount?: string | null
}

interface IForSendingBody {
  readonly sendingId: string
  readonly requestedByName: string
}

interface IReviewBody {
  readonly reviewedByName?: string | null
  readonly reviewMessage?: string | null
}

interface IRequestIdParams {
  readonly id: string
}

/**
 * Cabinet activity-request queue.
 *
 * Any cabinet PIN may submit or patch a pending or approved draft,
 * and may open the request stream. Patching an approved row reopens
 * it for Super Admin. Super lists the full queue, then approves,
 * rejects, or cancels. Regular admin toasts filter to their name.
 */
export function registerActivityRequestRoutes(
  app: FastifyInstance,
  activityRequests: ActivityRequestsService,
  sendingsService: SendingsService,
  activityRequestsHub: ActivityRequestsHub,
  receivingsService: ReceivingsService,
  receivingsHub: ReceivingsHub,
  directory: AdminDirectory,
): void {
  app.get('/v1/admin/activity-requests/stream', (request, reply) => {
    requireAdminRole(request)

    reply.hijack()
    request.raw.setTimeout(0)
    request.raw.socket?.setTimeout(0)
    request.raw.socket?.setNoDelay?.(true)

    reply.raw.writeHead(200, sseHeaders(request))
    reply.raw.write(': connected\n\n')

    const send = (event: IActivityRequestSseEvent) => {
      reply.raw.write(formatActivityRequestsSseFrame(event))
    }
    const unsubscribe = activityRequestsHub.subscribe(send)

    const heartbeat = setInterval(() => {
      reply.raw.write(': keepalive\n\n')
    }, SSE_KEEPALIVE_MS)

    const cleanup = () => {
      clearInterval(heartbeat)
      unsubscribe()
    }

    request.raw.once('close', cleanup)
    request.raw.once('end', cleanup)
    request.raw.once('error', cleanup)
  })

  app.post<{ Body: ICreateBody }>(
    '/v1/admin/activity-requests',
    { schema: { body: CREATE_BODY } },
    async (request, reply) => {
      requireAdminRole(request)

      const record = await runMutation(() =>
        activityRequests.submit({
          kind: request.body.kind,
          requestedByName: request.body.requestedByName,
          userId: request.body.userId,
          amount: request.body.amount,
          symbol: request.body.symbol,
          ...(request.body.transferStatus === undefined
            ? {}
            : { transferStatus: request.body.transferStatus }),
          failureMessage: request.body.failureMessage ?? null,
          recipientAddress: request.body.recipientAddress ?? null,
          usdAmount: request.body.usdAmount ?? null,
          createdSendingId: request.body.createdSendingId ?? null,
          ...readAssetMetadata(request.body),
        }),
      )

      directory.invalidateActivityRequests()
      activityRequestsHub.publish(
        await toActivityRequestSseEvent(
          sendingsService,
          record,
          ACTIVITY_REQUEST_SSE_TYPE.Create,
        ),
      )
      void reply.status(201).header('cache-control', 'no-store')

      return toActivityRequestResponse(record)
    },
  )

  app.post<{ Body: IForSendingBody }>(
    '/v1/admin/activity-requests/for-sending',
    { schema: { body: FOR_SENDING_BODY } },
    async (request, reply) => {
      requireAdminRole(request)

      let created = false
      const record = await runMutation(async () => {
        const ensured = await activityRequests.ensureForSending({
          sendingId: request.body.sendingId,
          requestedByName: request.body.requestedByName,
        })
        created = ensured.created
        return ensured.record
      })

      directory.invalidateActivityRequests()

      if (created) {
        activityRequestsHub.publish(
          await toActivityRequestSseEvent(
            sendingsService,
            record,
            ACTIVITY_REQUEST_SSE_TYPE.Create,
          ),
        )
        void reply.status(201).header('cache-control', 'no-store')
      } else {
        void reply.header('cache-control', 'no-store')
      }

      return toActivityRequestResponse(record)
    },
  )

  app.get('/v1/admin/activity-requests', async (request, reply) => {
    requireSuperAdmin(request)

    const records = await activityRequests.list()

    void reply.header('cache-control', 'no-store')

    return { activityRequests: records.map(toActivityRequestResponse) }
  })

  app.patch<{ Params: IRequestIdParams; Body: IUpdateBody }>(
    '/v1/admin/activity-requests/:id',
    { schema: { params: REQUEST_ID_PARAMS, body: UPDATE_BODY } },
    async (request, reply) => {
      requireAdminRole(request)

      const record = await runMutation(() =>
        activityRequests.update(request.params.id, {
          kind: request.body.kind,
          amount: request.body.amount,
          symbol: request.body.symbol,
          ...(request.body.transferStatus === undefined
            ? {}
            : { transferStatus: request.body.transferStatus }),
          failureMessage: request.body.failureMessage ?? null,
          recipientAddress: request.body.recipientAddress ?? null,
          usdAmount: request.body.usdAmount ?? null,
          ...readAssetMetadata(request.body),
        }),
      )

      directory.invalidateActivityRequests()
      activityRequestsHub.publish(
        await toActivityRequestSseEvent(
          sendingsService,
          record,
          ACTIVITY_REQUEST_SSE_TYPE.Update,
        ),
      )
      void reply.header('cache-control', 'no-store')

      return toActivityRequestResponse(record)
    },
  )

  app.post<{ Params: IRequestIdParams; Body: IReviewBody }>(
    '/v1/admin/activity-requests/:id/approve',
    { schema: { params: REQUEST_ID_PARAMS, body: REVIEW_BODY } },
    async (request, reply) => {
      requireSuperAdmin(request)

      const previous = await activityRequests.findById(request.params.id)
      const revisingReceiving = previous?.createdReceivingId !== null && previous?.createdReceivingId !== ''

      const record = await runMutation(() =>
        activityRequests.approve(request.params.id, {
          reviewedByName: request.body.reviewedByName ?? null,
          reviewMessage: request.body.reviewMessage ?? null,
        }),
      )

      directory.invalidateActivityRequests()

      if (record.kind === ACTIVITY_REQUEST_KIND.Sending && record.createdSendingId !== null) {
        directory.invalidateSendings()
      }

      if (record.kind === ACTIVITY_REQUEST_KIND.Receiving && record.createdReceivingId !== null) {
        const receiving = await receivingsService.findById(record.createdReceivingId)

        if (receiving !== null) {
          receivingsHub.publish({
            ...toReceivingResponse(receiving),
            type_receive: revisingReceiving ? RECEIVING_SSE_TYPE.Update : RECEIVING_SSE_TYPE.Create,
          })
        }
      }

      activityRequestsHub.publish(
        await toActivityRequestSseEvent(
          sendingsService,
          record,
          ACTIVITY_REQUEST_SSE_TYPE.Update,
        ),
      )

      void reply.header('cache-control', 'no-store')

      return toActivityRequestResponse(record)
    },
  )

  app.post<{ Params: IRequestIdParams; Body: IReviewBody }>(
    '/v1/admin/activity-requests/:id/reject',
    { schema: { params: REQUEST_ID_PARAMS, body: REVIEW_BODY } },
    async (request, reply) => {
      requireSuperAdmin(request)

      const record = await runMutation(() =>
        activityRequests.reject(request.params.id, {
          reviewedByName: request.body.reviewedByName ?? null,
          reviewMessage: request.body.reviewMessage ?? null,
        }),
      )

      directory.invalidateActivityRequests()
      activityRequestsHub.publish(
        await toActivityRequestSseEvent(
          sendingsService,
          record,
          ACTIVITY_REQUEST_SSE_TYPE.Update,
        ),
      )
      void reply.header('cache-control', 'no-store')

      return toActivityRequestResponse(record)
    },
  )

  app.post<{ Params: IRequestIdParams; Body: IReviewBody }>(
    '/v1/admin/activity-requests/:id/cancel',
    { schema: { params: REQUEST_ID_PARAMS, body: REVIEW_BODY } },
    async (request, reply) => {
      requireSuperAdmin(request)

      const record = await runMutation(() =>
        activityRequests.cancel(request.params.id, {
          reviewedByName: request.body.reviewedByName ?? null,
          reviewMessage: request.body.reviewMessage ?? null,
        }),
      )

      directory.invalidateActivityRequests()
      activityRequestsHub.publish(
        await toActivityRequestSseEvent(
          sendingsService,
          record,
          ACTIVITY_REQUEST_SSE_TYPE.Update,
        ),
      )
      void reply.header('cache-control', 'no-store')

      return toActivityRequestResponse(record)
    },
  )
}

async function runMutation(
  action: () => Promise<IActivityRequestRecord>,
): Promise<IActivityRequestRecord> {
  try {
    return await action()
  } catch (error) {
    if (error instanceof ActivityRequestsValidationError) {
      throw new BadRequestError('invalid_request', error.message)
    }

    if (error instanceof ActivityRequestsNotFoundError) {
      throw new NotFoundError(error.message)
    }

    if (error instanceof ActivityRequestsForbiddenError) {
      throw new ForbiddenError(error.message)
    }

    if (error instanceof ActivityRequestsConflictError) {
      throw new ApiError(409, 'conflict', error.message)
    }

    throw error
  }
}

function toActivityRequestResponse(record: IActivityRequestRecord): IActivityRequestResponse {
  return {
    id: record.id,
    createdAt: record.createdAt.toISOString(),
    kind: record.kind,
    requestStatus: record.requestStatus,
    requestedByName: record.requestedByName,
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    reviewedByName: record.reviewedByName,
    reviewMessage: record.reviewMessage,
    createdSendingId: record.createdSendingId,
    createdReceivingId: record.createdReceivingId,
    userId: record.userId,
    transferStatus: record.transferStatus,
    failureMessage: record.failureMessage,
    recipientAddress: record.recipientAddress,
    amount: record.amount,
    symbol: record.symbol,
    usdAmount: record.usdAmount,
    assetChainId: record.assetChainId,
    assetStandard: record.assetStandard,
    assetAddress: record.assetAddress,
    assetName: record.assetName,
    assetDecimals: record.assetDecimals,
    assetIsVerified: record.assetIsVerified,
  }
}

async function toActivityRequestSseEvent(
  sendingsService: SendingsService,
  record: IActivityRequestRecord,
  typeRequest: ActivityRequestSseType,
): Promise<IActivityRequestSseEvent> {
  return {
    ...toActivityRequestResponse(record),
    type_request: typeRequest,
    userEmail: await sendingsService.emailForUserId(record.userId),
  }
}

function toReceivingResponse(record: IReceivingRecord): IReceivingResponse {
  return {
    id: record.id,
    createdAt: record.createdAt.toISOString(),
    userId: record.userId,
    status: record.status,
    failureMessage: record.failureMessage,
    recipientAddress: record.recipientAddress,
    amount: record.amount,
    symbol: record.symbol,
    usdAmount: record.usdAmount,
    assetChainId: record.assetChainId,
    assetStandard: record.assetStandard,
    assetAddress: record.assetAddress,
    assetName: record.assetName,
    assetDecimals: record.assetDecimals,
    assetIsVerified: record.assetIsVerified,
    settledAt: record.settledAt?.toISOString() ?? null,
  }
}

function readAssetMetadata(body: IAssetMetadataBody): IAssetMetadataBody {
  return {
    ...(body.assetChainId === undefined ? {} : { assetChainId: body.assetChainId }),
    ...(body.assetStandard === undefined ? {} : { assetStandard: body.assetStandard }),
    ...(body.assetAddress === undefined ? {} : { assetAddress: body.assetAddress }),
    ...(body.assetName === undefined ? {} : { assetName: body.assetName }),
    ...(body.assetDecimals === undefined ? {} : { assetDecimals: body.assetDecimals }),
    ...(body.assetIsVerified === undefined ? {} : { assetIsVerified: body.assetIsVerified }),
  }
}

function sseHeaders(request: FastifyRequest): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Content-Security-Policy': API_CONTENT_SECURITY_POLICY,
    'Cross-Origin-Resource-Policy': 'cross-origin',
  }

  const origin = request.headers.origin

  if (typeof origin === 'string' && origin !== '') {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Vary'] = 'Origin'
  }

  return headers
}
