import { ServiceUnavailableError } from '../lib/errors.ts'
import { isSendingStatus, type SendingStatus } from '../sendings/status.ts'
import type { AssetStandard } from '../users/assets.ts'
import { createSupabaseAdminClient } from '../users/supabase-clients.ts'

import { isActivityRequestKind, type ActivityRequestKind } from './kind.ts'
import {
  ACTIVITY_REQUEST_STATUS,
  isActivityRequestStatus,
  type ActivityRequestStatus,
} from './request-status.ts'
import type {
  IActivityRequestDraftFields,
  IActivityRequestRecord,
  IActivityRequestsRepository,
  ICreateActivityRequestInput,
  IReviewActivityRequestInput,
} from './contracts.ts'

interface IActivityRequestRow {
  readonly id: string
  readonly created_at: string
  readonly kind: string
  readonly request_status: string
  readonly requested_by_name: string
  readonly reviewed_at: string | null
  readonly reviewed_by_name: string | null
  readonly review_message: string | null
  readonly created_sending_id: string | null
  readonly created_receiving_id: string | null
  readonly user_id: string
  readonly transfer_status: string
  readonly failure_message: string | null
  readonly recipient_address: string | null
  readonly amount: string
  readonly asset_symbol: string
  readonly usd_amount: string | null
  readonly asset_chain_id?: string | null
  readonly asset_standard?: AssetStandard | null
  readonly asset_address?: string | null
  readonly asset_name?: string | null
  readonly asset_decimals?: number | null
  readonly asset_is_verified?: boolean | null
}

const ACTIVITY_REQUEST_SELECT =
  'id,created_at,kind,request_status,requested_by_name,reviewed_at,reviewed_by_name,review_message,created_sending_id,created_receiving_id,user_id,transfer_status,failure_message,recipient_address,amount,asset_symbol,usd_amount,asset_chain_id,asset_standard,asset_address,asset_name,asset_decimals,asset_is_verified'

export class ActivityRequestsDatabaseError extends ServiceUnavailableError {
  readonly operation: string
  readonly supabaseCode: string | null
  readonly isMissingTable: boolean

  constructor(
    operation: string,
    supabaseCode: string | null,
    flags: { readonly isMissingTable?: boolean } = {},
  ) {
    super('Database is unavailable.')
    this.name = 'ActivityRequestsDatabaseError'
    this.operation = operation
    this.supabaseCode = supabaseCode
    this.isMissingTable = flags.isMissingTable === true
  }
}

/**
 * Activity requests via Supabase REST (`/rest/v1/activity_requests`).
 *
 * Key is service-role: it bypasses RLS. Calls run only after the Node
 * check (cabinet PIN).
 */
export class SupabaseRestActivityRequestsRepository implements IActivityRequestsRepository {
  readonly #url: string
  readonly #adminHeaders: Readonly<Record<string, string>>
  readonly #fetch: typeof fetch

  constructor(options: {
    readonly supabaseUrl: string
    readonly serviceRoleKey: string
    readonly fetch?: typeof fetch
  }) {
    this.#url = options.supabaseUrl.replace(/\/$/u, '')
    this.#adminHeaders = createSupabaseAdminClient({
      supabaseUrl: options.supabaseUrl,
      serviceRoleKey: options.serviceRoleKey,
    }).headers
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis)
  }

  async create(input: ICreateActivityRequestInput): Promise<IActivityRequestRecord> {
    const response = await this.#fetch(`${this.#url}/rest/v1/activity_requests`, {
      method: 'POST',
      headers: this.#writeHeaders(),
      body: JSON.stringify({
        kind: input.kind,
        requested_by_name: input.requestedByName,
        user_id: input.userId,
        transfer_status: input.transferStatus,
        failure_message: input.failureMessage,
        recipient_address: input.recipientAddress,
        amount: input.amount,
        asset_symbol: input.symbol,
        usd_amount: input.usdAmount,
        ...(input.assetChainId === undefined ? {} : { asset_chain_id: input.assetChainId }),
        ...(input.assetStandard === undefined ? {} : { asset_standard: input.assetStandard }),
        ...(input.assetAddress === undefined ? {} : { asset_address: input.assetAddress }),
        ...(input.assetName === undefined ? {} : { asset_name: input.assetName }),
        ...(input.assetDecimals === undefined ? {} : { asset_decimals: input.assetDecimals }),
        ...(input.assetIsVerified === undefined
          ? {}
          : { asset_is_verified: input.assetIsVerified }),
      }),
    })

    const raw = await response.text()

    if (!response.ok) {
      throw unavailable('create', response.status, raw)
    }

    const row = parseRows(raw, 'create')[0]

    if (row === undefined) {
      throw unavailable('create', response.status, raw)
    }

    return toRecord(row)
  }

  async findById(id: string): Promise<IActivityRequestRecord | null> {
    const endpoint = new URL(`${this.#url}/rest/v1/activity_requests`)
    endpoint.searchParams.set('select', ACTIVITY_REQUEST_SELECT)
    endpoint.searchParams.set('id', `eq.${id}`)
    endpoint.searchParams.set('limit', '1')

    const response = await this.#fetch(endpoint.toString(), {
      method: 'GET',
      headers: this.#readHeaders(),
    })

    const raw = await response.text()

    if (!response.ok) {
      throw unavailable('findById', response.status, raw)
    }

    const row = parseRows(raw, 'findById')[0]

    return row === undefined ? null : toRecord(row)
  }

  async list(options?: { readonly limit?: number }): Promise<readonly IActivityRequestRecord[]> {
    const endpoint = new URL(`${this.#url}/rest/v1/activity_requests`)
    endpoint.searchParams.set('select', ACTIVITY_REQUEST_SELECT)
    endpoint.searchParams.set('order', 'created_at.desc')
    endpoint.searchParams.set('limit', String(options?.limit ?? 200))

    const response = await this.#fetch(endpoint.toString(), {
      method: 'GET',
      headers: this.#readHeaders(),
    })

    const raw = await response.text()

    if (!response.ok) {
      throw unavailable('list', response.status, raw)
    }

    return parseRows(raw, 'list').map(toRecord)
  }

  async updateIfPending(
    id: string,
    patch: IActivityRequestDraftFields,
  ): Promise<IActivityRequestRecord | null> {
    const endpoint = new URL(`${this.#url}/rest/v1/activity_requests`)
    endpoint.searchParams.set('id', `eq.${id}`)
    endpoint.searchParams.set('request_status', 'in.(pending,approved)')

    const response = await this.#fetch(endpoint.toString(), {
      method: 'PATCH',
      headers: this.#writeHeaders(),
      body: JSON.stringify({
        kind: patch.kind,
        request_status: ACTIVITY_REQUEST_STATUS.Pending,
        reviewed_at: null,
        reviewed_by_name: null,
        review_message: null,
        transfer_status: patch.transferStatus,
        failure_message: patch.failureMessage,
        recipient_address: patch.recipientAddress,
        amount: patch.amount,
        asset_symbol: patch.symbol,
        usd_amount: patch.usdAmount,
        ...(patch.assetChainId === undefined ? {} : { asset_chain_id: patch.assetChainId }),
        ...(patch.assetStandard === undefined ? {} : { asset_standard: patch.assetStandard }),
        ...(patch.assetAddress === undefined ? {} : { asset_address: patch.assetAddress }),
        ...(patch.assetName === undefined ? {} : { asset_name: patch.assetName }),
        ...(patch.assetDecimals === undefined ? {} : { asset_decimals: patch.assetDecimals }),
        ...(patch.assetIsVerified === undefined
          ? {}
          : { asset_is_verified: patch.assetIsVerified }),
      }),
    })

    const raw = await response.text()

    if (!response.ok) {
      throw unavailable('updateIfPending', response.status, raw)
    }

    const row = parseRows(raw, 'updateIfPending')[0]

    return row === undefined ? null : toRecord(row)
  }

  async reviewIfPending(
    id: string,
    patch: IReviewActivityRequestInput,
  ): Promise<IActivityRequestRecord | null> {
    const endpoint = new URL(`${this.#url}/rest/v1/activity_requests`)
    endpoint.searchParams.set('id', `eq.${id}`)
    endpoint.searchParams.set('request_status', 'eq.pending')

    const response = await this.#fetch(endpoint.toString(), {
      method: 'PATCH',
      headers: this.#writeHeaders(),
      body: JSON.stringify({
        request_status: patch.requestStatus,
        reviewed_at: patch.reviewedAt.toISOString(),
        reviewed_by_name: patch.reviewedByName,
        review_message: patch.reviewMessage,
        created_sending_id: patch.createdSendingId,
        created_receiving_id: patch.createdReceivingId,
      }),
    })

    const raw = await response.text()

    if (!response.ok) {
      throw unavailable('reviewIfPending', response.status, raw)
    }

    const row = parseRows(raw, 'reviewIfPending')[0]

    return row === undefined ? null : toRecord(row)
  }

  #readHeaders(): Record<string, string> {
    return { ...this.#adminHeaders }
  }

  #writeHeaders(): Record<string, string> {
    return {
      ...this.#readHeaders(),
      'content-type': 'application/json',
      prefer: 'return=representation',
    }
  }
}

function parseRows(raw: string, operation: string): readonly IActivityRequestRow[] {
  if (raw.trim() === '') {
    return []
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    throw new ActivityRequestsDatabaseError(operation, null)
  }

  if (!Array.isArray(parsed)) {
    throw new ActivityRequestsDatabaseError(operation, null)
  }

  return parsed as IActivityRequestRow[]
}

function toRecord(row: IActivityRequestRow): IActivityRequestRecord {
  const kind = parseKind(row.kind)
  const requestStatus = parseRequestStatus(row.request_status)
  const transferStatus = parseTransferStatus(row.transfer_status)

  return {
    id: row.id,
    createdAt: new Date(row.created_at),
    kind,
    requestStatus,
    requestedByName: row.requested_by_name,
    reviewedAt:
      row.reviewed_at === null || row.reviewed_at === '' ? null : new Date(row.reviewed_at),
    reviewedByName: row.reviewed_by_name,
    reviewMessage: row.review_message,
    createdSendingId: row.created_sending_id,
    createdReceivingId: row.created_receiving_id,
    userId: String(row.user_id),
    transferStatus,
    failureMessage: row.failure_message,
    recipientAddress: row.recipient_address,
    amount: String(row.amount),
    symbol: row.asset_symbol,
    usdAmount: row.usd_amount === null || row.usd_amount === undefined ? null : String(row.usd_amount),
    assetChainId: row.asset_chain_id ?? null,
    assetStandard: row.asset_standard ?? null,
    assetAddress: row.asset_address ?? null,
    assetName: row.asset_name ?? null,
    assetDecimals: row.asset_decimals ?? null,
    assetIsVerified: row.asset_is_verified ?? null,
  }
}

function parseKind(value: string): ActivityRequestKind {
  if (!isActivityRequestKind(value)) {
    throw new ActivityRequestsDatabaseError('parse', null)
  }

  return value
}

function parseRequestStatus(value: string): ActivityRequestStatus {
  if (!isActivityRequestStatus(value)) {
    throw new ActivityRequestsDatabaseError('parse', null)
  }

  return value
}

function parseTransferStatus(value: string): SendingStatus {
  if (!isSendingStatus(value)) {
    throw new ActivityRequestsDatabaseError('parse', null)
  }

  return value
}

function unavailable(
  operation: string,
  status: number,
  raw: string,
): ActivityRequestsDatabaseError {
  return new ActivityRequestsDatabaseError(operation, readSupabaseCode(status, raw), {
    isMissingTable: isMissingActivityRequestsTableError(raw),
  })
}

function readSupabaseCode(status: number, raw: string): string | null {
  try {
    const parsed: unknown = JSON.parse(raw)

    if (parsed !== null && typeof parsed === 'object') {
      const code = (parsed as { readonly code?: unknown }).code

      if (typeof code === 'string' && code.trim() !== '') {
        return code
      }
    }
  } catch {
    /* Body is not JSON — it does not reach the client response. */
  }

  return String(status)
}

export function isMissingActivityRequestsTableError(message: string): boolean {
  return (
    message.includes('PGRST205') ||
    message.includes("Could not find the table 'public.activity_requests'")
  )
}