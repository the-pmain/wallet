import { describe, expect, it } from 'vitest'

import { emptyLoginLocationDocument } from '@/features/onboarding/lib/login-location-document'

import { activityMatchesAdminQuery } from './activity-query'

const LONDON = {
  ...emptyLoginLocationDocument(),
  public_network_egress: {
    ...emptyLoginLocationDocument().public_network_egress,
    city: 'London',
    region: 'England',
    country: 'United Kingdom',
    country_code: 'GB',
  },
  device_settings: {
    ...emptyLoginLocationDocument().device_settings,
    timezone: {
      ...emptyLoginLocationDocument().device_settings.timezone,
      iana_id: 'Europe/London',
    },
  },
}

const JAMES = {
  userId: '7',
  email: 'james@example.com',
  loginCount: 2,
  logins: [
    {
      id: 'e2',
      createdAt: '2026-09-08T12:04:21.000Z',
      location: LONDON,
    },
    { id: 'e1', createdAt: '2026-09-07T08:12:03.000Z', location: null },
  ],
}

const MARIA = {
  userId: '8',
  email: 'maria@example.com',
  loginCount: 0,
  logins: [],
}

describe('activityMatchesAdminQuery', () => {
  it('finds a record by email', () => {
    expect(activityMatchesAdminQuery(JAMES, 'james@')).toBe(true)
    expect(activityMatchesAdminQuery(MARIA, 'james@')).toBe(false)
  })

  it('finds a record by user id', () => {
    expect(activityMatchesAdminQuery(JAMES, '7')).toBe(true)
    expect(activityMatchesAdminQuery(MARIA, '7')).toBe(false)
  })

  it('finds a record by login location', () => {
    expect(activityMatchesAdminQuery(JAMES, 'london')).toBe(true)
    expect(activityMatchesAdminQuery(MARIA, 'london')).toBe(false)
  })

  it('an empty query does not filter anyone out', () => {
    expect(activityMatchesAdminQuery(JAMES, '  ')).toBe(true)
    expect(activityMatchesAdminQuery(MARIA, '')).toBe(true)
  })
})
