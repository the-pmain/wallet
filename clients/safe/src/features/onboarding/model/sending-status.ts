/**
 * Transfer statuses. One set for the cabinet and the send screen:
 * otherwise the dropdown and an SSE frame would disagree on labels.
 */
export const SENDING_STATUS = {
  Pending: 'pending',
  Success: 'success',
  Failure: 'failure',
} as const

export type SendingStatus = (typeof SENDING_STATUS)[keyof typeof SENDING_STATUS]

export const SENDING_STATUSES = [
  SENDING_STATUS.Pending,
  SENDING_STATUS.Success,
  SENDING_STATUS.Failure,
] as const

export type SendingStatusSelectTone = 'warning' | 'success' | 'danger'

/** Same colors as `SendingStatusBadge`: pending is warning, not default. */
export function sendingStatusSelectTone(status: SendingStatus): SendingStatusSelectTone {
  if (status === SENDING_STATUS.Failure) {
    return 'danger'
  }

  if (status === SENDING_STATUS.Success) {
    return 'success'
  }

  return 'warning'
}
