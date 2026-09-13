import { describe, expect, it } from 'vitest'

import { emptyLoginLocationDocument } from '@/features/onboarding/lib/login-location-document'

import { formatLoginLocation } from './format-login-location'

describe('formatLoginLocation', () => {
  it('prefers IP city and country from location', () => {
    const location = emptyLoginLocationDocument()

    expect(
      formatLoginLocation({
        ...location,
        public_network_egress: {
          ...location.public_network_egress,
          city: 'London',
          region: 'England',
          country: 'United Kingdom',
          country_code: 'GB',
        },
        most_likely_physical_region: {
          ...location.most_likely_physical_region,
          country: 'United Kingdom',
        },
        device_settings: {
          ...location.device_settings,
          timezone: { ...location.device_settings.timezone, iana_id: 'Europe/London' },
        },
      }),
    ).toBe('London, United Kingdom')
  })

  it('falls back to timezone when geo is missing', () => {
    const location = emptyLoginLocationDocument()

    expect(
      formatLoginLocation({
        ...location,
        device_settings: {
          ...location.device_settings,
          timezone: { ...location.device_settings.timezone, iana_id: 'Europe/London' },
        },
      }),
    ).toBe('Europe/London')
    expect(formatLoginLocation(null)).toBeNull()
    expect(formatLoginLocation(emptyLoginLocationDocument())).toBeNull()
  })
})
