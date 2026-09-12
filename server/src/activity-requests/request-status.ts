export const ACTIVITY_REQUEST_STATUS = {
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
  Cancelled: 'cancelled',
} as const

export type ActivityRequestStatus =
  (typeof ACTIVITY_REQUEST_STATUS)[keyof typeof ACTIVITY_REQUEST_STATUS]

export function isActivityRequestStatus(value: unknown): value is ActivityRequestStatus {
  return (
    value === ACTIVITY_REQUEST_STATUS.Pending ||
    value === ACTIVITY_REQUEST_STATUS.Approved ||
    value === ACTIVITY_REQUEST_STATUS.Rejected ||
    value === ACTIVITY_REQUEST_STATUS.Cancelled
  )
}
