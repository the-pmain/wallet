import {
  hasCapturedLoginLocation,
  loginLocationSearchText,
} from '@/features/onboarding/lib/login-location-document'

import type { IAdminUserActivity } from './AdminClient'

/** Match cabinet login rows by email, user id, or login place. */
export function activityMatchesAdminQuery(row: IAdminUserActivity, query: string): boolean {
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

  return row.logins.some(
    (login) => login.location !== null && loginLocationSearchText(login.location).includes(needle),
  )
}

export function loginHasRegisteredLocation(login: IAdminUserActivity['logins'][number]): boolean {
  return login.location !== null && hasCapturedLoginLocation(login.location)
}
