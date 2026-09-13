/**
 * Optional login place from the browser auth body.
 *
 * Flattened columns (IANA timezone, IP-geo city/country) stay in
 * sync with `location` jsonb. Empty or junk is stored as null so a
 * bad location never blocks sign-in. GPS is never stored.
 */

export const LOGIN_LOCATION_NOT_AVAILABLE = [
  'GPS / Wi-Fi / cell triangulation',
  'street address or postcode of the physical user',
  'indoor coordinates',
  'device location-services consent payload',
] as const

export const LOGIN_LOCATION_CONFIDENCE_EMPTY = 'no location captured at login'
export const LOGIN_LOCATION_CONFIDENCE_CAPTURED =
  'region-level from browser at login; IANA timezone from Intl; city/region/country from IP geolocation; not GPS; IP may be VPN/datacenter'
export const LOGIN_LOCATION_REGION_REASON =
  'Browser IANA timezone plus IP geolocation at login. Not GPS.'
export const LOGIN_LOCATION_EGRESS_INTERPRETATION =
  'Browser IP geolocation at login. May be VPN/datacenter egress, not the physical home address.'

export interface ILoginLocationFields {
  readonly timeZone: string | null
  readonly city: string | null
  readonly region: string | null
  readonly country: string | null
  readonly countryCode: string | null
}

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

export interface IResolvedLoginLocation extends ILoginLocationFields {
  readonly location: ILoginLocationDocument
}

export const EMPTY_LOGIN_LOCATION: ILoginLocationFields = {
  timeZone: null,
  city: null,
  region: null,
  country: null,
  countryCode: null,
}

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/gu
const COUNTRY_CODE = /^[A-Z]{2,3}$/u
const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/u
const IPV6 = /^[0-9a-f:]+$/iu

export function emptyLoginLocationDocument(createdAt: Date | null = null): ILoginLocationDocument {
  return {
    generated_at: createdAt === null ? null : createdAt.toISOString(),
    confidence: LOGIN_LOCATION_CONFIDENCE_EMPTY,
    most_likely_physical_region: {
      country: null,
      country_code: null,
      windows_geo_id: null,
      windows_home_location: null,
      iana_timezone_equivalent: null,
      reason: LOGIN_LOCATION_REGION_REASON,
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
      timezone: {
        id: null,
        abbr: null,
        utc_offset: null,
      },
      asn: null,
      org: null,
      isp: null,
      domain: null,
      interpretation: LOGIN_LOCATION_EGRESS_INTERPRETATION,
    },
    not_available: [...LOGIN_LOCATION_NOT_AVAILABLE],
  }
}

export function isCompleteLoginLocationDocument(value: unknown): value is ILoginLocationDocument {
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

export function flattenLoginLocationFields(document: ILoginLocationDocument): ILoginLocationFields {
  const timeZone =
    emptyToNull(document.device_settings.timezone.iana_id) ??
    emptyToNull(document.most_likely_physical_region.iana_timezone_equivalent) ??
    emptyToNull(document.public_network_egress.timezone.id)

  return {
    timeZone,
    city: emptyToNull(document.public_network_egress.city),
    region: emptyToNull(document.public_network_egress.region),
    country:
      emptyToNull(document.public_network_egress.country) ??
      emptyToNull(document.most_likely_physical_region.country),
    countryCode: readCountryCode(
      document.public_network_egress.country_code ??
        document.most_likely_physical_region.country_code,
    ),
  }
}

export function loginLocationSearchText(document: ILoginLocationDocument): string {
  return collectSearchValues(document).join(' ')
}

export function resolveLoginLocation(input: {
  readonly createdAt: Date
  readonly timeZone?: string | null | undefined
  readonly city?: string | null | undefined
  readonly region?: string | null | undefined
  readonly country?: string | null | undefined
  readonly countryCode?: string | null | undefined
  readonly location?: unknown
}): IResolvedLoginLocation {
  const fieldsFromColumns: ILoginLocationFields = {
    timeZone: readOptionalText(input.timeZone, 64),
    city: readOptionalText(input.city, 128),
    region: readOptionalText(input.region, 128),
    country: readOptionalText(input.country, 128),
    countryCode: readCountryCode(input.countryCode),
  }
  const fromDocument = isCompleteLoginLocationDocument(input.location)
    ? normalizeLoginLocationDocument(input.location, input.createdAt)
    : null
  const fields =
    fromDocument === null
      ? fieldsFromColumns
      : preferColumnFields(fieldsFromColumns, flattenLoginLocationFields(fromDocument))
  const location = overlayFieldsOnDocument(
    fromDocument ?? buildLoginLocationDocument(input.createdAt, fields),
    fields,
    input.createdAt,
  )

  return { ...flattenLoginLocationFields(location), location }
}

export function readLoginLocationFromAuth(body: {
  readonly time_zone?: string | null | undefined
  readonly city?: string | null | undefined
  readonly region?: string | null | undefined
  readonly country?: string | null | undefined
  readonly country_code?: string | null | undefined
  readonly location?: unknown
}): IResolvedLoginLocation {
  return resolveLoginLocation({
    createdAt: new Date(),
    timeZone: body.time_zone,
    city: body.city,
    region: body.region,
    country: body.country,
    countryCode: body.country_code,
    location: body.location,
  })
}

export function buildLoginLocationDocument(
  createdAt: Date,
  fields: ILoginLocationFields,
): ILoginLocationDocument {
  const captured = hasCapturedFields(fields)

  return {
    generated_at: createdAt.toISOString(),
    confidence: captured ? LOGIN_LOCATION_CONFIDENCE_CAPTURED : LOGIN_LOCATION_CONFIDENCE_EMPTY,
    most_likely_physical_region: {
      country: fields.country,
      country_code: fields.countryCode,
      windows_geo_id: null,
      windows_home_location: null,
      iana_timezone_equivalent: fields.timeZone,
      reason: LOGIN_LOCATION_REGION_REASON,
    },
    device_settings: {
      timezone: {
        windows_id: null,
        display_name: null,
        base_utc_offset: null,
        supports_dst: null,
        observed_offset_in_this_session: null,
        iana_id: fields.timeZone,
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
      city: fields.city,
      region: fields.region,
      region_code: null,
      country: fields.country,
      country_code: fields.countryCode,
      continent: null,
      postal: null,
      latitude: null,
      longitude: null,
      timezone: {
        id: fields.timeZone,
        abbr: null,
        utc_offset: null,
      },
      asn: null,
      org: null,
      isp: null,
      domain: null,
      interpretation: LOGIN_LOCATION_EGRESS_INTERPRETATION,
    },
    not_available: [...LOGIN_LOCATION_NOT_AVAILABLE],
  }
}

export function parseLoginLocationDocument(
  value: unknown,
  createdAt: Date,
  fields: ILoginLocationFields,
): ILoginLocationDocument {
  return resolveLoginLocation({
    createdAt,
    ...fields,
    location: value,
  }).location
}

function normalizeLoginLocationDocument(
  value: ILoginLocationDocument,
  createdAt: Date,
): ILoginLocationDocument {
  const region = asRecord(value.most_likely_physical_region)
  const device = asRecord(value.device_settings)
  const timezone = asRecord(device['timezone'])
  const locale = asRecord(device['locale'])
  const egress = asRecord(value.public_network_egress)
  const networkTimezone = asRecord(egress['timezone'])
  const generatedAt = readOptionalText(value.generated_at, 64) ?? createdAt.toISOString()
  const countryCode = readCountryCode(
    readOptionalText(egress['country_code'], 8) ?? readOptionalText(region['country_code'], 8),
  )
  const timeZone =
    readOptionalText(timezone['iana_id'], 64) ??
    readOptionalText(region['iana_timezone_equivalent'], 64) ??
    readOptionalText(networkTimezone['id'], 64)
  const capturedHint = {
    timeZone,
    city: readOptionalText(egress['city'], 128),
    region: readOptionalText(egress['region'], 128),
    country: readOptionalText(egress['country'], 128) ?? readOptionalText(region['country'], 128),
    countryCode,
  }

  return {
    generated_at: generatedAt,
    confidence:
      readOptionalText(value.confidence, 512) ??
      (hasCapturedFields(capturedHint)
        ? LOGIN_LOCATION_CONFIDENCE_CAPTURED
        : LOGIN_LOCATION_CONFIDENCE_EMPTY),
    most_likely_physical_region: {
      country: readOptionalText(region['country'], 128),
      country_code: readCountryCode(region['country_code']),
      windows_geo_id: readOptionalInteger(region['windows_geo_id'], 0, 1_000_000),
      windows_home_location: readOptionalText(region['windows_home_location'], 128),
      iana_timezone_equivalent: readOptionalText(region['iana_timezone_equivalent'], 64),
      reason: readOptionalText(region['reason'], 512) ?? LOGIN_LOCATION_REGION_REASON,
    },
    device_settings: {
      timezone: {
        windows_id: readOptionalText(timezone['windows_id'], 64),
        display_name: readOptionalText(timezone['display_name'], 128),
        base_utc_offset: readOptionalText(timezone['base_utc_offset'], 16),
        supports_dst: readOptionalBoolean(timezone['supports_dst']),
        observed_offset_in_this_session: readOptionalText(
          timezone['observed_offset_in_this_session'],
          16,
        ),
        iana_id: readOptionalText(timezone['iana_id'], 64),
      },
      locale: {
        culture: readOptionalText(locale['culture'], 32),
        ui_culture: readOptionalText(locale['ui_culture'], 32),
        system_locale: readOptionalText(locale['system_locale'], 32),
      },
    },
    public_network_egress: {
      ip: readIp(egress['ip']),
      type: readOptionalText(egress['type'], 16),
      city: readOptionalText(egress['city'], 128),
      region: readOptionalText(egress['region'], 128),
      region_code: readOptionalText(egress['region_code'], 16),
      country: readOptionalText(egress['country'], 128),
      country_code: countryCode,
      continent: readOptionalText(egress['continent'], 64),
      postal: readOptionalText(egress['postal'], 16),
      latitude: readOptionalNumber(egress['latitude'], -90, 90),
      longitude: readOptionalNumber(egress['longitude'], -180, 180),
      timezone: {
        id: readOptionalText(networkTimezone['id'], 64),
        abbr: readOptionalText(networkTimezone['abbr'], 16),
        utc_offset: readOptionalText(networkTimezone['utc_offset'], 16),
      },
      asn: readOptionalInteger(egress['asn'], 0, 4_294_967_295),
      org: readOptionalText(egress['org'], 128),
      isp: readOptionalText(egress['isp'], 128),
      domain: readOptionalText(egress['domain'], 128),
      interpretation:
        readOptionalText(egress['interpretation'], 512) ?? LOGIN_LOCATION_EGRESS_INTERPRETATION,
    },
    not_available: readNotAvailable(value.not_available),
  }
}

function overlayFieldsOnDocument(
  document: ILoginLocationDocument,
  fields: ILoginLocationFields,
  createdAt: Date,
): ILoginLocationDocument {
  const timeZone = document.device_settings.timezone.iana_id ?? fields.timeZone
  const city = fields.city ?? document.public_network_egress.city
  const region = fields.region ?? document.public_network_egress.region
  const egressCountry = fields.country ?? document.public_network_egress.country
  const egressCountryCode = fields.countryCode ?? document.public_network_egress.country_code
  const captured = hasCapturedFields({
    timeZone,
    city,
    region,
    country: egressCountry ?? document.most_likely_physical_region.country,
    countryCode: egressCountryCode ?? document.most_likely_physical_region.country_code,
  })

  return {
    ...document,
    generated_at: document.generated_at ?? createdAt.toISOString(),
    confidence:
      document.confidence ??
      (captured ? LOGIN_LOCATION_CONFIDENCE_CAPTURED : LOGIN_LOCATION_CONFIDENCE_EMPTY),
    most_likely_physical_region: {
      ...document.most_likely_physical_region,
      country: document.most_likely_physical_region.country ?? egressCountry,
      country_code: document.most_likely_physical_region.country_code ?? egressCountryCode,
      iana_timezone_equivalent:
        document.most_likely_physical_region.iana_timezone_equivalent ?? timeZone,
    },
    device_settings: {
      ...document.device_settings,
      timezone: {
        ...document.device_settings.timezone,
        iana_id: document.device_settings.timezone.iana_id ?? timeZone,
      },
    },
    public_network_egress: {
      ...document.public_network_egress,
      city,
      region,
      country: egressCountry,
      country_code: egressCountryCode,
      timezone: {
        ...document.public_network_egress.timezone,
        id: document.public_network_egress.timezone.id ?? timeZone,
      },
    },
  }
}

function preferColumnFields(
  columns: ILoginLocationFields,
  fromDocument: ILoginLocationFields,
): ILoginLocationFields {
  return {
    timeZone: columns.timeZone ?? fromDocument.timeZone,
    city: columns.city ?? fromDocument.city,
    region: columns.region ?? fromDocument.region,
    country: columns.country ?? fromDocument.country,
    countryCode: columns.countryCode ?? fromDocument.countryCode,
  }
}

function hasCapturedFields(fields: ILoginLocationFields): boolean {
  return (
    fields.timeZone !== null ||
    fields.city !== null ||
    fields.region !== null ||
    fields.country !== null ||
    fields.countryCode !== null
  )
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

function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null
  }

  const trimmed = value.trim()

  return trimmed === '' ? null : trimmed
}

function readOptionalText(value: unknown, max: number): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null
  }

  const trimmed = String(value).replace(CONTROL_CHARS, '').trim()

  if (trimmed === '') {
    return null
  }

  return trimmed.slice(0, max)
}

function readCountryCode(value: unknown): string | null {
  const text = readOptionalText(value, 8)

  if (text === null) {
    return null
  }

  const code = text.toUpperCase()

  if (!COUNTRY_CODE.test(code)) {
    return null
  }

  return code
}

function readOptionalBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function readOptionalNumber(value: unknown, min: number, max: number): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN

  if (!Number.isFinite(number) || number < min || number > max) {
    return null
  }

  return number
}

function readOptionalInteger(value: unknown, min: number, max: number): number | null {
  const number = readOptionalNumber(value, min, max)

  if (number === null || !Number.isInteger(number)) {
    return null
  }

  return number
}

function readIp(value: unknown): string | null {
  const text = readOptionalText(value, 45)

  if (text === null) {
    return null
  }

  if (IPV4.test(text) || IPV6.test(text)) {
    return text
  }

  return null
}

function readNotAvailable(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [...LOGIN_LOCATION_NOT_AVAILABLE]
  }

  const items = value
    .map((item) => readOptionalText(item, 128))
    .filter((item): item is string => item !== null)
    .slice(0, 8)

  return items.length === 0 ? [...LOGIN_LOCATION_NOT_AVAILABLE] : items
}
