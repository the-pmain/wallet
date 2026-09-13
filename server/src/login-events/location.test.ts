import { describe, expect, it } from 'vitest'

import {
  EMPTY_LOGIN_LOCATION,
  LOGIN_LOCATION_CONFIDENCE_CAPTURED,
  hasCapturedLoginLocation,
  isCompleteLoginLocationDocument,
  readLoginLocationFromAuth,
  resolveLoginLocation,
} from './location.ts'

describe('readLoginLocationFromAuth', () => {
  it('reads timezone and IP-geo fields into flattened columns and location', () => {
    const resolved = readLoginLocationFromAuth({
      time_zone: 'Europe/London',
      city: 'London',
      region: 'England',
      country: 'United Kingdom',
      country_code: 'gb',
    })

    expect(resolved).toMatchObject({
      timeZone: 'Europe/London',
      city: 'London',
      region: 'England',
      country: 'United Kingdom',
      countryCode: 'GB',
    })
    expect(isCompleteLoginLocationDocument(resolved.location)).toBe(true)
    expect(hasCapturedLoginLocation(resolved.location)).toBe(true)
    expect(resolved.location).toMatchObject({
      confidence: LOGIN_LOCATION_CONFIDENCE_CAPTURED,
      most_likely_physical_region: {
        country: 'United Kingdom',
        country_code: 'GB',
        iana_timezone_equivalent: 'Europe/London',
      },
      device_settings: { timezone: { iana_id: 'Europe/London' } },
      public_network_egress: {
        city: 'London',
        region: 'England',
        country: 'United Kingdom',
        country_code: 'GB',
      },
    })
  })

  it('empty and missing become null columns and an empty location document', () => {
    const empty = readLoginLocationFromAuth({})
    const junk = readLoginLocationFromAuth({
      time_zone: '  ',
      city: null,
      country_code: 'G',
    })

    expect(empty).toMatchObject(EMPTY_LOGIN_LOCATION)
    expect(junk).toMatchObject(EMPTY_LOGIN_LOCATION)
    expect(hasCapturedLoginLocation(empty.location)).toBe(false)
    expect(hasCapturedLoginLocation(junk.location)).toBe(false)
  })

  it('keeps a full location document and overlays non-null columns', () => {
    const resolved = readLoginLocationFromAuth({
      city: 'Roeselare',
      country: 'Belgium',
      country_code: 'BE',
      location: {
        generated_at: '2026-09-13T08:43:35.000Z',
        confidence: LOGIN_LOCATION_CONFIDENCE_CAPTURED,
        most_likely_physical_region: {
          country: 'Belgium',
          country_code: 'BE',
          windows_geo_id: null,
          windows_home_location: null,
          iana_timezone_equivalent: 'Europe/Brussels',
          reason: 'Browser IANA timezone plus IP geolocation at login. Not GPS.',
        },
        device_settings: {
          timezone: {
            windows_id: null,
            display_name: null,
            base_utc_offset: null,
            supports_dst: null,
            observed_offset_in_this_session: '+02:00',
            iana_id: 'Europe/Brussels',
          },
          locale: {
            culture: 'en-US',
            ui_culture: 'en-US',
            system_locale: 'en-US',
          },
        },
        public_network_egress: {
          ip: '81.2.69.142',
          type: 'IPv4',
          city: 'Ghent',
          region: 'West Flanders',
          region_code: 'VWV',
          country: 'Belgium',
          country_code: 'BE',
          continent: 'Europe',
          postal: null,
          latitude: 51.23,
          longitude: 3.21,
          timezone: { id: 'Europe/Brussels', abbr: 'CEST', utc_offset: '+02:00' },
          asn: 5432,
          org: 'Proximus',
          isp: 'Proximus',
          domain: 'proximus.be',
          interpretation: 'Browser IP geolocation at login.',
        },
        not_available: [
          'GPS / Wi-Fi / cell triangulation',
          'street address or postcode of the physical user',
          'indoor coordinates',
          'device location-services consent payload',
        ],
      },
    })

    expect(resolved.city).toBe('Roeselare')
    expect(resolved.location.public_network_egress.city).toBe('Roeselare')
    expect(resolved.location.public_network_egress.ip).toBe('81.2.69.142')
    expect(resolved.location.device_settings.locale.culture).toBe('en-US')
    expect(resolved.location.device_settings.timezone.observed_offset_in_this_session).toBe(
      '+02:00',
    )
  })

  it('does not copy IP country onto most_likely_physical_region', () => {
    const resolved = readLoginLocationFromAuth({
      time_zone: 'Europe/London',
      city: 'Montreal',
      region: 'Quebec',
      country: 'Canada',
      country_code: 'CA',
      location: {
        generated_at: '2026-09-12T13:37:00.000+01:00',
        confidence: 'region-level for device settings; IP is datacenter/VPN, not a home address',
        most_likely_physical_region: {
          country: 'United Kingdom',
          country_code: 'GB',
          windows_geo_id: 242,
          windows_home_location: 'United Kingdom',
          iana_timezone_equivalent: 'Europe/London',
          reason: 'Windows home location is United Kingdom',
        },
        device_settings: {
          timezone: {
            windows_id: 'GMT Standard Time',
            display_name: '(UTC+00:00) Dublin, Edinburgh, Lisbon, London',
            base_utc_offset: '+00:00',
            supports_dst: true,
            observed_offset_in_this_session: '+01:00',
            iana_id: 'Europe/London',
          },
          locale: {
            culture: 'en-US',
            ui_culture: 'en-US',
            system_locale: 'en-US',
          },
        },
        public_network_egress: {
          ip: '66.163.113.57',
          type: 'IPv4',
          city: 'Montreal',
          region: 'Quebec',
          region_code: 'QC',
          country: 'Canada',
          country_code: 'CA',
          continent: 'North America',
          postal: 'H3H',
          latitude: 45.5088435,
          longitude: -73.5878058,
          timezone: { id: 'America/Toronto', abbr: 'EDT', utc_offset: '-04:00' },
          asn: 62563,
          org: 'GTHost',
          isp: 'GLOBALTELEHOST Corp.',
          domain: 'gthost.com',
          interpretation: 'Datacenter/VPN/proxy egress in Montreal, Canada.',
        },
        not_available: [
          'GPS / Wi-Fi / cell triangulation',
          'street address or postcode of the physical user',
          'indoor coordinates',
          'device location-services consent payload',
        ],
      },
    })

    expect(resolved.country).toBe('Canada')
    expect(resolved.countryCode).toBe('CA')
    expect(resolved.timeZone).toBe('Europe/London')
    expect(resolved.location.most_likely_physical_region.country).toBe('United Kingdom')
    expect(resolved.location.most_likely_physical_region.windows_geo_id).toBe(242)
    expect(resolved.location.public_network_egress.country).toBe('Canada')
    expect(resolved.location.public_network_egress.ip).toBe('66.163.113.57')
    expect(resolved.location.device_settings.timezone.windows_id).toBe('GMT Standard Time')
  })
})

describe('resolveLoginLocation', () => {
  it('builds a complete document from flattened columns', () => {
    const createdAt = new Date('2026-09-08T12:04:21.000Z')
    const resolved = resolveLoginLocation({
      createdAt,
      timeZone: 'Europe/London',
      city: 'London',
      region: 'England',
      country: 'United Kingdom',
      countryCode: 'GB',
    })

    expect(resolved.location.generated_at).toBe(createdAt.toISOString())
    expect(resolved.location.public_network_egress.ip).toBeNull()
    expect(resolved.location.not_available).toHaveLength(4)
  })
})
