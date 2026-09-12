import {
  parseRemoteReceiving,
  parseRemoteSending,
  type IRemoteReceiving,
  type IRemoteSending,
} from '@/features/onboarding'

export const ADMIN_PAGE_SIZE = 20

export interface IAdminPageQuery {
  readonly page: number
  readonly pageSize: number
  readonly q: string
  readonly status?: 'pending' | 'approved' | 'rejected' | 'cancelled'
  readonly requestedBy?: string
  readonly userId?: string
}

export interface IAdminPage<T> {
  readonly items: readonly T[]
  readonly page: number
  readonly pageSize: number
  readonly total: number
}

export interface IAdminDirectorySending extends IRemoteSending {
  readonly userEmail: string | null
}

export interface IAdminDirectoryReceiving extends IRemoteReceiving {
  readonly userEmail: string | null
}

export type ActivityRequestKind = 'sending' | 'receiving'
export type ActivityRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface IAdminActivityRequest {
  readonly id: string
  readonly createdAt: string
  readonly kind: ActivityRequestKind
  readonly requestStatus: ActivityRequestStatus
  readonly requestedByName: string
  readonly reviewedAt: string | null
  readonly reviewedByName: string | null
  readonly reviewMessage: string | null
  readonly createdSendingId: string | null
  readonly createdReceivingId: string | null
  readonly userId: string
  readonly transferStatus: 'pending' | 'success' | 'failure'
  readonly failureMessage: string | null
  readonly recipientAddress: string | null
  readonly amount: string
  readonly symbol: string
  readonly usdAmount: string | null
  readonly assetChainId?: string | null
  readonly assetStandard?: 'native' | 'ERC-20' | null
  readonly assetAddress?: string | null
  readonly assetName?: string | null
  readonly assetDecimals?: number | null
  readonly assetIsVerified?: boolean | null
}

export interface IAdminDirectoryActivityRequest extends IAdminActivityRequest {
  readonly userEmail: string | null
}

export function adminPageSearch(query: IAdminPageQuery): string {
  const params = new URLSearchParams()

  params.set('page', String(query.page))
  params.set('pageSize', String(query.pageSize))

  const q = query.q.trim()

  if (q !== '') {
    params.set('q', q)
  }

  if (query.status !== undefined) {
    params.set('status', query.status)
  }

  const requestedBy = query.requestedBy?.trim() ?? ''

  if (requestedBy !== '') {
    params.set('requestedBy', requestedBy)
  }

  const userId = query.userId?.trim() ?? ''

  if (userId !== '') {
    params.set('userId', userId)
  }

  return `?${params.toString()}`
}

export function parseAdminPage<T>(
  payload: unknown,
  parseItem: (item: unknown) => T | null,
): IAdminPage<T> | null {
  if (payload === null || typeof payload !== 'object') {
    return null
  }

  const record = payload as Record<string, unknown>
  const items = record['items']
  const page = record['page']
  const pageSize = record['pageSize']
  const total = record['total']

  if (!Array.isArray(items)) {
    return null
  }

  if (!isPageInt(page) || !isPageInt(pageSize) || !isPageInt(total)) {
    return null
  }

  const parsed: T[] = []

  for (const item of items) {
    const row = parseItem(item)

    if (row === null) {
      return null
    }

    parsed.push(row)
  }

  return {
    items: parsed,
    page,
    pageSize,
    total,
  }
}

export function parseAdminDirectorySending(payload: unknown): IAdminDirectorySending | null {
  const sending = parseRemoteSending(payload)

  if (sending === null) {
    return null
  }

  const userEmail = readJoinedEmail(payload)

  if (userEmail === undefined) {
    return null
  }

  return { ...sending, userEmail }
}

export function parseAdminDirectoryReceiving(payload: unknown): IAdminDirectoryReceiving | null {
  const receiving = parseRemoteReceiving(payload)

  if (receiving === null) {
    return null
  }

  const userEmail = readJoinedEmail(payload)

  if (userEmail === undefined) {
    return null
  }

  return { ...receiving, userEmail }
}

export function parseAdminDirectoryActivityRequest(
  payload: unknown,
): IAdminDirectoryActivityRequest | null {
  const request = parseActivityRequest(payload)

  if (request === null) {
    return null
  }

  const userEmail = readJoinedEmail(payload)

  if (userEmail === undefined) {
    return null
  }

  return { ...request, userEmail }
}

export function parseActivityRequest(payload: unknown): IAdminActivityRequest | null {
  if (payload === null || typeof payload !== 'object') {
    return null
  }

  const record = payload as Record<string, unknown>
  const kind = record['kind']
  const requestStatus = record['requestStatus']
  const transferStatus = record['transferStatus']

  if (
    typeof record['id'] !== 'string' ||
    record['id'] === '' ||
    typeof record['createdAt'] !== 'string' ||
    (kind !== 'sending' && kind !== 'receiving') ||
    (requestStatus !== 'pending' &&
      requestStatus !== 'approved' &&
      requestStatus !== 'rejected' &&
      requestStatus !== 'cancelled') ||
    typeof record['requestedByName'] !== 'string' ||
    record['requestedByName'].trim() === '' ||
    typeof record['userId'] !== 'string' ||
    record['userId'] === '' ||
    (transferStatus !== 'pending' &&
      transferStatus !== 'success' &&
      transferStatus !== 'failure') ||
    typeof record['amount'] !== 'string' ||
    typeof record['symbol'] !== 'string'
  ) {
    return null
  }

  const assetChainId = optionalNullableString(record['assetChainId'])
  const assetStandard = optionalAssetStandard(record['assetStandard'])
  const assetAddress = optionalNullableString(record['assetAddress'])
  const assetName = optionalNullableString(record['assetName'])
  const assetDecimals = optionalNullableNumber(record['assetDecimals'])
  const assetIsVerified = optionalNullableBoolean(record['assetIsVerified'])

  return {
    id: record['id'],
    createdAt: record['createdAt'],
    kind,
    requestStatus,
    requestedByName: record['requestedByName'],
    reviewedAt: readNullableStringField(record['reviewedAt']),
    reviewedByName: readNullableStringField(record['reviewedByName']),
    reviewMessage: readNullableStringField(record['reviewMessage']),
    createdSendingId: readNullableStringField(record['createdSendingId']),
    createdReceivingId: readNullableStringField(record['createdReceivingId']),
    userId: record['userId'],
    transferStatus,
    failureMessage: readNullableStringField(record['failureMessage']),
    recipientAddress: readNullableStringField(record['recipientAddress']),
    amount: record['amount'],
    symbol: record['symbol'],
    usdAmount: readNullableStringField(record['usdAmount']),
    ...(assetChainId === undefined ? {} : { assetChainId }),
    ...(assetStandard === undefined ? {} : { assetStandard }),
    ...(assetAddress === undefined ? {} : { assetAddress }),
    ...(assetName === undefined ? {} : { assetName }),
    ...(assetDecimals === undefined ? {} : { assetDecimals }),
    ...(assetIsVerified === undefined ? {} : { assetIsVerified }),
  }
}

function readNullableStringField(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed === '' ? null : trimmed
}

function optionalNullableString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined
  }

  return readNullableStringField(value)
}

function optionalAssetStandard(
  value: unknown,
): 'native' | 'ERC-20' | null | undefined {
  if (value === undefined) {
    return undefined
  }

  if (value === null || value === 'native' || value === 'ERC-20') {
    return value
  }

  return undefined
}

function optionalNullableNumber(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function optionalNullableBoolean(value: unknown): boolean | null | undefined {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  return typeof value === 'boolean' ? value : undefined
}

export function emptyAdminPage<T>(pageSize: number = ADMIN_PAGE_SIZE): IAdminPage<T> {
  return {
    items: [],
    page: 1,
    pageSize,
    total: 0,
  }
}

function readJoinedEmail(payload: unknown): string | null | undefined {
  if (payload === null || typeof payload !== 'object') {
    return undefined
  }

  const userEmail = (payload as Record<string, unknown>)['userEmail']

  if (userEmail === null) {
    return null
  }

  if (typeof userEmail !== 'string') {
    return undefined
  }

  return userEmail === '' ? null : userEmail
}

function isPageInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}
