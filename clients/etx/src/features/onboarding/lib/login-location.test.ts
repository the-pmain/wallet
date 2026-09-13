import { describe, expect, it, vi } from 'vitest'

import {
  LOGIN_GEO_URL,
  assembleLoginLocationDocument,
  readLoginLocation,
  toAuthLocationBody,
} from './login-location'

describe('readLoginLocation', () => {
  it('reads timezone from Intl and city from geojs', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            city: 'London',
            region: 'England',
            country: 'United Kingdom',
            country_code: 'GB',
          }),
        ),
    })

    const location = await readLoginLocation(fetchMock as unknown as typeof fetch)

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(LOGIN_GEO_URL)
    expect(location.city).toBe('London')
    expect(location.region).toBe('England')
    expect(location.country).toBe('United Kingdom')
    expect(location.countryCode).toBe('GB')
    expect(typeof location.timeZone).toBe('string')
    expect(location.document.public_network_egress.city).toBe('London')
    expect(toAuthLocationBody(location)).toMatchObject({
      city: 'London',
      country: 'United Kingdom',
      country_code: 'GB',
      region: 'England',
      location: expect.objectContaining({
        public_network_egress: expect.objectContaining({ city: 'London' }),
      }),
    })
  })

  it('parses geojs network fields onto public_network_egress', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            ip: '66.163.113.57',
            city: 'Montreal',
            region: 'Quebec',
            region_code: 'QC',
            country: 'Canada',
            country_code: 'CA',
            continent_code: 'NA',
            latitude: '45.5088435',
            longitude: '-73.5878058',
            timezone: 'America/Toronto',
            asn: 62563,
            organization: 'AS62563 GLOBALTELEHOST Corp.',
            organization_name: 'GLOBALTELEHOST Corp.',
            postal: 'H3H',
          }),
        ),
    })

    const location = await readLoginLocation(fetchMock as unknown as typeof fetch)

    expect(location.city).toBe('Montreal')
    expect(location.country).toBe('Canada')
    expect(location.document.public_network_egress).toMatchObject({
      ip: '66.163.113.57',
      type: 'IPv4',
      region_code: 'QC',
      continent: 'North America',
      postal: 'H3H',
      latitude: 45.5088435,
      longitude: -73.5878058,
      timezone: { id: 'America/Toronto' },
      asn: 62563,
      org: 'GLOBALTELEHOST Corp.',
      isp: 'GLOBALTELEHOST Corp.',
    })
  })

  it('still returns timezone when geojs fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))

    const location = await readLoginLocation(fetchMock as unknown as typeof fetch)

    expect(location.city).toBeNull()
    expect(location.country).toBeNull()
    expect(typeof location.timeZone === 'string' || location.timeZone === null).toBe(true)
    expect(location.document.public_network_egress.city).toBeNull()
  })
})

describe('assembleLoginLocationDocument', () => {
  it('uses the device timezone as most_likely when IP geo is a datacenter in another country', () => {
    const document = assembleLoginLocationDocument(
      {
        ianaId: 'Europe/London',
        culture: 'en-US',
        uiCulture: 'en-US',
        systemLocale: 'en-US',
      },
      {
        ip: '66.163.113.57',
        type: 'IPv4',
        city: 'Montreal',
        region: 'Quebec',
        regionCode: 'QC',
        country: 'Canada',
        countryCode: 'CA',
        continent: 'North America',
        postal: 'H3H',
        latitude: 45.5088435,
        longitude: -73.5878058,
        timezone: 'America/Toronto',
        asn: 62563,
        org: 'GTHost',
        isp: 'GLOBALTELEHOST Corp.',
        domain: 'gthost.com',
      },
      new Date('2026-09-12T12:37:00.000Z'),
    )

    expect(document.generated_at).toBe('2026-09-12T13:37:00.000+01:00')
    expect(document.confidence).toBe(
      'region-level for device settings; IP is datacenter/VPN, not a home address',
    )
    expect(document.most_likely_physical_region).toMatchObject({
      country: 'United Kingdom',
      country_code: 'GB',
      windows_geo_id: 242,
      windows_home_location: 'United Kingdom',
      iana_timezone_equivalent: 'Europe/London',
    })
    expect(document.most_likely_physical_region.reason).toContain('GMT Standard Time')
    expect(document.device_settings.timezone).toMatchObject({
      windows_id: 'GMT Standard Time',
      display_name: '(UTC+00:00) Dublin, Edinburgh, Lisbon, London',
      base_utc_offset: '+00:00',
      supports_dst: true,
      observed_offset_in_this_session: '+01:00',
      iana_id: 'Europe/London',
    })
    expect(document.device_settings.locale).toEqual({
      culture: 'en-US',
      ui_culture: 'en-US',
      system_locale: 'en-US',
    })
    expect(document.public_network_egress).toMatchObject({
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
      timezone: { id: 'America/Toronto', utc_offset: '-04:00' },
      asn: 62563,
      org: 'GTHost',
      isp: 'GLOBALTELEHOST Corp.',
      domain: 'gthost.com',
    })
    expect(document.public_network_egress.interpretation).toContain('Datacenter/VPN/proxy')
    expect(document.not_available).toHaveLength(4)
  })
})
