import {
  parseAdminDirectoryActivityRequest,
  type IAdminDirectoryActivityRequest,
} from './admin-page'

export const ACTIVITY_REQUEST_SSE_TYPE = {
  Create: 'create',
  Update: 'update',
} as const

export type ActivityRequestSseType =
  (typeof ACTIVITY_REQUEST_SSE_TYPE)[keyof typeof ACTIVITY_REQUEST_SSE_TYPE]

export interface IActivityRequestSseEvent extends IAdminDirectoryActivityRequest {
  readonly type_request: ActivityRequestSseType
}

function isActivityRequestSseType(value: unknown): value is ActivityRequestSseType {
  return (
    value === ACTIVITY_REQUEST_SSE_TYPE.Create || value === ACTIVITY_REQUEST_SSE_TYPE.Update
  )
}

/**
 * Parses `data` of an `activity-requests` SSE frame. Broken JSON and
 * frames without `type_request` are dropped so keepalive does not
 * grow the cabinet queue.
 */
export function parseActivityRequestSseEvent(data: string): IActivityRequestSseEvent | null {
  let payload: unknown

  try {
    payload = JSON.parse(data) as unknown
  } catch {
    return null
  }

  if (payload === null || typeof payload !== 'object') {
    return null
  }

  const request = parseAdminDirectoryActivityRequest(payload)

  if (request === null) {
    return null
  }

  const typeRequest = (payload as Record<string, unknown>)['type_request']

  if (!isActivityRequestSseType(typeRequest)) {
    return null
  }

  return {
    ...request,
    type_request: typeRequest,
  }
}

export function activityRequestsSseUrl(baseUrl: string): string {
  const path = '/v1/admin/activity-requests/stream'

  if (baseUrl === '') {
    return path
  }

  return `${baseUrl.replace(/\/$/u, '')}${path}`
}

export function requestFromSseEvent(event: IActivityRequestSseEvent): IAdminDirectoryActivityRequest {
  const { type_request: _typeRequest, ...request } = event

  return request
}
