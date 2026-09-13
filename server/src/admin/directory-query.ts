import type { IUserLoginActivity } from '../login-events/activity.ts'
import { loginLocationSearchText } from '../login-events/location.ts'
import type { IUserRecord } from '../users/contracts.ts'

/** Match a cabinet transfer by id, user, email, address, amount, ticker, or status. */
export function directoryTransferMatches(
  record: {
    readonly id: string
    readonly userId: string | null
    readonly status: string | null
    readonly recipientAddress: string | null
    readonly amount: string | null
    readonly symbol: string | null
    readonly usdAmount?: string | null
  },
  query: string,
  email: string | null,
): boolean {
  const needle = query.trim().toLowerCase()

  if (needle === '') {
    return true
  }

  if (record.id.toLowerCase().includes(needle)) {
    return true
  }

  if ((record.userId ?? '').toLowerCase().includes(needle)) {
    return true
  }

  if ((email ?? '').toLowerCase().includes(needle)) {
    return true
  }

  if ((record.recipientAddress ?? '').toLowerCase().includes(needle)) {
    return true
  }

  if ((record.amount ?? '').toLowerCase().includes(needle)) {
    return true
  }

  if ((record.symbol ?? '').toLowerCase().includes(needle)) {
    return true
  }

  if ((record.usdAmount ?? '').toLowerCase().includes(needle)) {
    return true
  }

  return (record.status ?? '').toLowerCase().includes(needle)
}

/** Match a directory user by id, email, or a wallet address. */
export function directoryUserMatches(user: IUserRecord, query: string): boolean {
  const needle = query.trim().toLowerCase()

  if (needle === '') {
    return true
  }

  if (user.id.toLowerCase().includes(needle)) {
    return true
  }

  if ((user.email ?? '').toLowerCase().includes(needle)) {
    return true
  }

  return Object.values(user.wallets).some((entry) => entry.key.toLowerCase().includes(needle))
}

/** Match a cabinet activity-request by transfer fields, operator, or status. */
export function directoryActivityRequestMatches(
  record: {
    readonly id: string
    readonly userId: string | null
    readonly kind: string
    readonly requestStatus: string
    readonly requestedByName: string
    readonly reviewedByName: string | null
    readonly reviewMessage: string | null
    readonly transferStatus: string | null
    readonly recipientAddress: string | null
    readonly amount: string | null
    readonly symbol: string | null
    readonly usdAmount?: string | null
  },
  query: string,
  email: string | null,
): boolean {
  if (
    directoryTransferMatches(
      {
        id: record.id,
        userId: record.userId,
        status: record.requestStatus,
        recipientAddress: record.recipientAddress,
        amount: record.amount,
        symbol: record.symbol,
        ...(record.usdAmount === undefined ? {} : { usdAmount: record.usdAmount }),
      },
      query,
      email,
    )
  ) {
    return true
  }

  const needle = query.trim().toLowerCase()

  if (needle === '') {
    return true
  }

  if (record.kind.toLowerCase().includes(needle)) {
    return true
  }

  if (record.requestedByName.toLowerCase().includes(needle)) {
    return true
  }

  if ((record.reviewedByName ?? '').toLowerCase().includes(needle)) {
    return true
  }

  if ((record.reviewMessage ?? '').toLowerCase().includes(needle)) {
    return true
  }

  return (record.transferStatus ?? '').toLowerCase().includes(needle)
}

/** Match a login-activity row by user id, email, or place. */
export function directoryActivityMatches(row: IUserLoginActivity, query: string): boolean {
  const needle = query.trim().toLowerCase()

  if (needle === '') {
    return true
  }

  if (row.userId.toLowerCase().includes(needle)) {
    return true
  }

  if ((row.email ?? '').toLowerCase().includes(needle)) {
    return true
  }

  return row.logins.some((login) => loginPlaceMatches(login, needle))
}

function loginPlaceMatches(
  login: IUserLoginActivity['logins'][number],
  needle: string,
): boolean {
  return loginLocationSearchText(login.location).includes(needle)
}
