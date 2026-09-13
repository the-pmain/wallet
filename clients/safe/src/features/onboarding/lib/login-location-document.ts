/**
 * Login `location` jsonb document from the cabinet API.
 *
 * The nested keys match public.login_events.location. Missing or
 * partial objects are not the new model — parse returns null so the
 * activity row stays a static line instead of a dropdown.
 */

export const LOGIN_LOCATION_NOT_AVAILABLE = [
  'GPS / Wi-Fi / cell triangulation',
  'street address or postcode of the physical user',
  'indoor coordinates',
  'device location-services consent payload',
] as const

export interface ILoginLocationTimezone {
  readonly windows_id: string | null
  readonly display_name: string | null
  readonly base_utc_offset: string | null
  readonly supports_dst: boolean | null
  readonly observed_offset_in_this_session: string | null
  readonly iana_id: string | null
}

export interface ILoginLocationLocale {
  readonly culture: string | null
  readonly ui_culture: string | null
  readonly system_locale: string | null
}

export interface ILoginLocationPhysicalRegion {
  readonly country: string | null
  readonly country_code: string | null
  readonly windows_geo_id: number | null
  readonly windows_home_location: string | null
  readonly iana_timezone_equivalent: string | null
  readonly reason: string | null
}

export interface ILoginLocationDeviceSettings {
  readonly timezone: ILoginLocationTimezone
  readonly locale: ILoginLocationLocale
}

export interface ILoginLocationNetworkTimezone {
  readonly id: string | null
  readonly abbr: string | null
  readonly utc_offset: string | null
}

export interface ILoginLocationNetworkEgress {
  readonly ip: string | null
  readonly type: string | null
  readonly city: string | null
  readonly region: string | null
  readonly region_code: string | null
  readonly country: string | null
  readonly country_code: string | null
  readonly continent: string | null
  readonly postal: string | null
  readonly latitude: number | null
  readonly longitude: number | null
  readonly timezone: ILoginLocationNetworkTimezone
  readonly asn: number | null
  readonly org: string | null
  readonly isp: string | null
  readonly domain: string | null
  readonly interpretation: string | null
}

export interface ILoginLocationDocument {
  readonly generated_at: string | null
  readonly confidence: string | null
  readonly most_likely_physical_region: ILoginLocationPhysicalRegion
  readonly device_settings: ILoginLocationDeviceSettings
  readonly public_network_egress: ILoginLocationNetworkEgress
  readonly not_available: readonly string[]
}

export function isCompleteLoginLocationDocument(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const record = value as Record<string, unknown>

  return (
    'generated_at' in record &&
    'confidence' in record &&
    'most_likely_physical_region' in record &&
    'device_settings' in record &&
    'public_network_egress' in record &&
    'not_available' in record
  )
}

export function parseLoginLocationDocument(value: unknown): ILoginLocationDocument | null {
  if (!isCompleteLoginLocationDocument(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const region = asRecord(record['most_likely_physical_region'])
  const device = asRecord(record['device_settings'])
  const timezone = asRecord(device['timezone'])
  const locale = asRecord(device['locale'])
  const egress = asRecord(record['public_network_egress'])
  const networkTimezone = asRecord(egress['timezone'])

  return {
    generated_at: readText(record['generated_at'], 64),
    confidence: readText(record['confidence'], 512),
    most_likely_physical_region: {
      country: readText(region['country'], 128),
      country_code: readCountryCode(region['country_code']),
      windows_geo_id: readInteger(region['windows_geo_id']),
      windows_home_location: readText(region['windows_home_location'], 128),
      iana_timezone_equivalent: readText(region['iana_timezone_equivalent'], 64),
      reason: readText(region['reason'], 512),
    },
    device_settings: {
      timezone: {
        windows_id: readText(timezone['windows_id'], 64),
        display_name: readText(timezone['display_name'], 128),
        base_utc_offset: readText(timezone['base_utc_offset'], 16),
        supports_dst: typeof timezone['supports_dst'] === 'boolean' ? timezone['supports_dst'] : null,
        observed_offset_in_this_session: readText(timezone['observed_offset_in_this_session'], 16),
        iana_id: readText(timezone['iana_id'], 64),
      },
      locale: {
        culture: readText(locale['culture'], 32),
        ui_culture: readText(locale['ui_culture'], 32),
        system_locale: readText(locale['system_locale'], 32),
      },
    },
    public_network_egress: {
      ip: readText(egress['ip'], 45),
      type: readText(egress['type'], 16),
      city: readText(egress['city'], 128),
      region: readText(egress['region'], 128),
      region_code: readText(egress['region_code'], 16),
      country: readText(egress['country'], 128),
      country_code: readCountryCode(egress['country_code']),
      continent: readText(egress['continent'], 64),
      postal: readText(egress['postal'], 16),
      latitude: readNumber(egress['latitude'], -90, 90),
      longitude: readNumber(egress['longitude'], -180, 180),
      timezone: {
        id: readText(networkTimezone['id'], 64),
        abbr: readText(networkTimezone['abbr'], 16),
        utc_offset: readText(networkTimezone['utc_offset'], 16),
      },
      asn: readInteger(egress['asn']),
      org: readText(egress['org'], 128),
      isp: readText(egress['isp'], 128),
      domain: readText(egress['domain'], 128),
      interpretation: readText(egress['interpretation'], 512),
    },
    not_available: readNotAvailable(record['not_available']),
  }
}

export function hasCapturedLoginLocation(document: ILoginLocationDocument): boolean {
  const region = document.most_likely_physical_region
  const device = document.device_settings
  const egress = document.public_network_egress

  return (
    region.country !== null ||
    region.country_code !== null ||
    region.iana_timezone_equivalent !== null ||
    region.windows_home_location !== null ||
    region.windows_geo_id !== null ||
    device.timezone.iana_id !== null ||
    device.timezone.windows_id !== null ||
    device.timezone.display_name !== null ||
    device.locale.culture !== null ||
    device.locale.ui_culture !== null ||
    device.locale.system_locale !== null ||
    egress.ip !== null ||
    egress.city !== null ||
    egress.region !== null ||
    egress.country !== null ||
    egress.country_code !== null ||
    egress.continent !== null ||
    egress.postal !== null ||
    egress.latitude !== null ||
    egress.longitude !== null ||
    egress.org !== null ||
    egress.isp !== null ||
    egress.domain !== null ||
    egress.timezone.id !== null
  )
}

export function loginLocationSearchText(document: ILoginLocationDocument): string {
  return collectSearchValues(document).join(' ')
}

export function emptyLoginLocationDocument(generatedAt: string | null = null): ILoginLocationDocument {
  return {
    generated_at: generatedAt,
    confidence: 'no location captured at login',
    most_likely_physical_region: {
      country: null,
      country_code: null,
      windows_geo_id: null,
      windows_home_location: null,
      iana_timezone_equivalent: null,
      reason: 'Browser IANA timezone plus IP geolocation at login. Not GPS.',
    },
    device_settings: {
      timezone: {
        windows_id: null,
        display_name: null,
        base_utc_offset: null,
        supports_dst: null,
        observed_offset_in_this_session: null,
        iana_id: null,
      },
      locale: {
        culture: null,
        ui_culture: null,
        system_locale: null,
      },
    },
    public_network_egress: {
      ip: null,
      type: null,
      city: null,
      region: null,
      region_code: null,
      country: null,
      country_code: null,
      continent: null,
      postal: null,
      latitude: null,
      longitude: null,
      timezone: { id: null, abbr: null, utc_offset: null },
      asn: null,
      org: null,
      isp: null,
      domain: null,
      interpretation:
        'Browser IP geolocation at login. May be VPN/datacenter egress, not the physical home address.',
    },
    not_available: [...LOGIN_LOCATION_NOT_AVAILABLE],
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function readText(value: unknown, max: number): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null
  }

  const trimmed = String(value).trim()

  if (trimmed === '') {
    return null
  }

  return trimmed.slice(0, max)
}

function readCountryCode(value: unknown): string | null {
  const text = readText(value, 8)

  if (text === null) {
    return null
  }

  const code = text.toUpperCase()

  return /^[A-Z]{2,3}$/u.test(code) ? code : null
}

function readNumber(value: unknown, min: number, max: number): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN

  if (!Number.isFinite(number) || number < min || number > max) {
    return null
  }

  return number
}

function readInteger(value: unknown): number | null {
  const number = readNumber(value, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)

  if (number === null || !Number.isInteger(number)) {
    return null
  }

  return number
}

function readNotAvailable(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [...LOGIN_LOCATION_NOT_AVAILABLE]
  }

  const items = value
    .map((item) => readText(item, 128))
    .filter((item): item is string => item !== null)
    .slice(0, 8)

  return items.length === 0 ? [...LOGIN_LOCATION_NOT_AVAILABLE] : items
}

function collectSearchValues(value: unknown): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase()

    return trimmed === '' ? [] : [trimmed]
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return [String(value)]
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectSearchValues)
  }

  if (value === null || typeof value !== 'object') {
    return []
  }

  return Object.values(value as Record<string, unknown>).flatMap(collectSearchValues)
}
