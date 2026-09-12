export const ACTIVITY_REQUEST_KIND = {
  Sending: 'sending',
  Receiving: 'receiving',
} as const

export type ActivityRequestKind =
  (typeof ACTIVITY_REQUEST_KIND)[keyof typeof ACTIVITY_REQUEST_KIND]

export function isActivityRequestKind(value: unknown): value is ActivityRequestKind {
  return value === ACTIVITY_REQUEST_KIND.Sending || value === ACTIVITY_REQUEST_KIND.Receiving
}
