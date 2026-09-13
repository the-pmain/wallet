import { describe, expect, it } from 'vitest'

import {
  hasCapturedLoginLocation,
  parseLoginLocationDocument,
} from './login-location-document'

describe('parseLoginLocationDocument', () => {
  it('rejects a missing or partial object', () => {
    expect(parseLoginLocationDocument(undefined)).toBeNull()
    expect(parseLoginLocationDocument({})).toBeNull()
    expect(parseLoginLocationDocument({ city: 'London' })).toBeNull()
  })

  it('reads a complete document', () => {
    const parsed = parseLoginLocationDocument({
      generated_at: '2026-09-08T12:04:21.000Z',
      confidence: 'region-level from browser at login',
      most_likely_physical_region: {
        country: 'United Kingdom',
        country_code: 'gb',
        windows_geo_id: null,
        windows_home_location: null,
        iana_timezone_equivalent: 'Europe/London',
        reason: null,
      },
      device_settings: {
        timezone: {
          windows_id: null,
          display_name: null,
          base_utc_offset: null,
          supports_dst: null,
          observed_offset_in_this_session: '+01:00',
          iana_id: 'Europe/London',
        },
        locale: { culture: 'en-US', ui_culture: null, system_locale: null },
      },
      public_network_egress: {
        ip: '81.2.69.142',
        type: 'IPv4',
        city: 'London',
        region: 'England',
        region_code: null,
        country: 'United Kingdom',
        country_code: 'GB',
        continent: 'Europe',
        postal: null,
        latitude: 51.5,
        longitude: -0.1,
        timezone: { id: 'Europe/London', abbr: null, utc_offset: null },
        asn: 2856,
        org: 'BT',
        isp: 'BT',
        domain: null,
        interpretation: null,
      },
      not_available: ['GPS / Wi-Fi / cell triangulation'],
    })

    expect(parsed?.public_network_egress.ip).toBe('81.2.69.142')
    expect(parsed?.most_likely_physical_region.country_code).toBe('GB')
    expect(parsed && hasCapturedLoginLocation(parsed)).toBe(true)
  })
})
