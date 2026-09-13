/**
 * Place of a successful app sign-in, from the browser.
 *
 * Timezone and locale come from `Intl` (always available, no permission).
 * City/country/IP come from geojs IP geolocation. GPS is not used.
 * A failed lookup still signs in; only timezone may be sent.
 */

import { emptyLoginLocationDocument, type ILoginLocationDocument } from './login-location-document'
import {
  continentName,
  lookupCountry,
  lookupCountryFromIana,
  lookupWindowsZone,
  looksLikeDatacenterEgress,
} from './login-location-maps'

export const LOGIN_GEO_URL = 'https://get.geojs.io/v1/ip/geo.json'
const GEO_TIMEOUT_MS = 2500

export interface ILoginLocation {
  readonly timeZone: string | null
  readonly city: string | null
  readonly region: string | null
  readonly country: string | null
  readonly countryCode: string | null
  readonly document: ILoginLocationDocument
}

export interface ICapturedDeviceSettings {
  readonly ianaId: string | null
  readonly culture: string | null
  readonly uiCulture: string | null
  readonly systemLocale: string | null
}

export interface ICapturedNetworkGeo {
  readonly ip: string | null
  readonly type: string | null
  readonly city: string | null
  readonly region: string | null
  readonly regionCode: string | null
  readonly country: string | null
  readonly countryCode: string | null
  readonly continent: string | null
  readonly postal: string | null
  readonly latitude: number | null
  readonly longitude: number | null
  readonly timezone: string | null
  readonly asn: number | null
  readonly org: string | null
  readonly isp: string | null
  readonly domain: string | null
}

export async function readLoginLocation(
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  timeoutMs: number = GEO_TIMEOUT_MS,
  now: Date = new Date(),
): Promise<ILoginLocation> {
  const device = readDeviceSettings()
  const geo = await readIpGeo(fetchImpl, timeoutMs)
  const document = assembleLoginLocationDocument(device, geo, now)

  return {
    timeZone: document.device_settings.timezone.iana_id,
    city: document.public_network_egress.city,
    region: document.public_network_egress.region,
    country: document.public_network_egress.country,
    countryCode: document.public_network_egress.country_code,
    document,
  }
}

export function toAuthLocationBody(location: ILoginLocation): Record<string, unknown> {
  const body: Record<string, unknown> = {
    location: location.document,
  }

  if (location.timeZone !== null) {
    body['time_zone'] = location.timeZone
  }

  if (location.city !== null) {
    body['city'] = location.city
  }

  if (location.region !== null) {
    body['region'] = location.region
  }

  if (location.country !== null) {
    body['country'] = location.country
  }

  if (location.countryCode !== null) {
    body['country_code'] = location.countryCode
  }

  return body
}

export function assembleLoginLocationDocument(
  device: ICapturedDeviceSettings,
  geo: ICapturedNetworkGeo,
  now: Date = new Date(),
): ILoginLocationDocument {
  const deviceOffsets = readZoneOffsets(device.ianaId, now)
  const networkOffsets = readZoneOffsets(geo.timezone, now)
  const windows = lookupWindowsZone(device.ianaId)
  const deviceCountry = lookupCountryFromIana(device.ianaId)
  const ipCountry = lookupCountry(geo.countryCode)
  const ipCountryName = geo.country ?? ipCountry?.name ?? null
  const ipCountryCode = geo.countryCode ?? ipCountry?.code ?? null
  const regionCountry = deviceCountry ?? ipCountry
  const regionCountryName = regionCountry?.name ?? ipCountryName
  const regionCountryCode = regionCountry?.code ?? ipCountryCode
  const conflict = deviceAndIpConflict(
    deviceCountry?.code ?? null,
    ipCountryCode,
    device.ianaId,
    geo.timezone,
  )
  const hosting = looksLikeDatacenterEgress(geo.org, geo.isp)
  const captured =
    device.ianaId !== null ||
    device.culture !== null ||
    geo.city !== null ||
    geo.country !== null ||
    geo.countryCode !== null ||
    geo.ip !== null
  const displayName =
    windows?.displayName ??
    (device.ianaId !== null && deviceOffsets.base !== null
      ? `(UTC${deviceOffsets.base}) ${device.ianaId.replaceAll('_', ' ')}`
      : null)
  const document = emptyLoginLocationDocument(formatGeneratedAt(now, deviceOffsets.observed))

  return {
    ...document,
    generated_at: formatGeneratedAt(now, deviceOffsets.observed),
    confidence: captured
      ? conflict || hosting
        ? 'region-level for device settings; IP is datacenter/VPN, not a home address'
        : 'region-level from browser at login; IANA timezone from Intl; city/region/country from IP geolocation; not GPS; IP may be VPN/datacenter'
      : document.confidence,
    most_likely_physical_region: {
      country: regionCountryName,
      country_code: regionCountryCode,
      windows_geo_id: regionCountry?.geoId ?? null,
      windows_home_location: regionCountryName,
      iana_timezone_equivalent: device.ianaId,
      reason: buildRegionReason({
        windowsHome: regionCountryName,
        windowsId: windows?.windowsId ?? null,
        ianaId: device.ianaId,
        offset: deviceOffsets.observed,
        abbr: deviceOffsets.abbr,
        now,
      }),
    },
    device_settings: {
      timezone: {
        windows_id: windows?.windowsId ?? null,
        display_name: displayName,
        base_utc_offset: deviceOffsets.base,
        supports_dst: deviceOffsets.supportsDst,
        observed_offset_in_this_session: deviceOffsets.observed,
        iana_id: device.ianaId,
      },
      locale: {
        culture: device.culture,
        ui_culture: device.uiCulture,
        system_locale: device.systemLocale,
      },
    },
    public_network_egress: {
      ...document.public_network_egress,
      ip: geo.ip,
      type: geo.type,
      city: geo.city,
      region: geo.region,
      region_code: geo.regionCode,
      country: ipCountryName,
      country_code: ipCountryCode,
      continent: geo.continent,
      postal: geo.postal,
      latitude: geo.latitude,
      longitude: geo.longitude,
      timezone: {
        id: geo.timezone,
        abbr: networkOffsets.abbr,
        utc_offset: networkOffsets.observed,
      },
      asn: geo.asn,
      org: geo.org,
      isp: geo.isp,
      domain: geo.domain,
      interpretation: buildEgressInterpretation({
        hosting,
        conflict,
        city: geo.city,
        country: ipCountryName,
        deviceCountry: deviceCountry?.name ?? null,
        offset: deviceOffsets.observed,
      }),
    },
  }
}

function readDeviceSettings(): ICapturedDeviceSettings {
  const culture = readIntlLocale()
  const uiCulture = clip(globalThis.navigator?.language, 32)
  const systemLocale = clip(
    globalThis.navigator?.languages?.[0] ?? globalThis.navigator?.language,
    32,
  )

  return {
    ianaId: readTimeZone(),
    culture,
    uiCulture: uiCulture ?? culture,
    systemLocale: systemLocale ?? uiCulture ?? culture,
  }
}

function readTimeZone(): string | null {
  try {
    return clip(Intl.DateTimeFormat().resolvedOptions().timeZone, 64)
  } catch {
    return null
  }
}

function readIntlLocale(): string | null {
  try {
    return clip(Intl.DateTimeFormat().resolvedOptions().locale, 32)
  } catch {
    return clip(globalThis.navigator?.language, 32)
  }
}

interface IZoneOffsets {
  readonly observed: string | null
  readonly base: string | null
  readonly supportsDst: boolean | null
  readonly abbr: string | null
}

function readZoneOffsets(timeZone: string | null, now: Date): IZoneOffsets {
  if (timeZone === null) {
    return { observed: null, base: null, supportsDst: null, abbr: null }
  }

  const year = now.getUTCFullYear()
  const observed = readZoneOffset(timeZone, now)
  const january = readZoneOffset(timeZone, new Date(Date.UTC(year, 0, 1)))
  const july = readZoneOffset(timeZone, new Date(Date.UTC(year, 6, 1)))
  const supportsDst = january !== null && july !== null ? january !== july : null

  return {
    observed: observed ?? fallbackLocalOffset(timeZone, now),
    base: pickStandardOffset(january, july) ?? observed,
    supportsDst,
    abbr: readZoneAbbr(timeZone, now),
  }
}

function fallbackLocalOffset(timeZone: string, now: Date): string | null {
  try {
    if (Intl.DateTimeFormat().resolvedOptions().timeZone !== timeZone) {
      return null
    }

    const minutes = -now.getTimezoneOffset()
    const sign = minutes >= 0 ? '+' : '-'
    const absolute = Math.abs(minutes)
    const hours = String(Math.floor(absolute / 60)).padStart(2, '0')
    const rest = String(absolute % 60).padStart(2, '0')

    return `${sign}${hours}:${rest}`
  } catch {
    return null
  }
}

function pickStandardOffset(january: string | null, july: string | null): string | null {
  if (january === null) {
    return july
  }

  if (july === null || offsetMinutes(january) <= offsetMinutes(july)) {
    return january
  }

  return july
}

function offsetMinutes(offset: string): number {
  const parsed = parseOffset(offset)

  return parsed === null ? 0 : parsed
}

function readZoneOffset(timeZone: string, date: Date): string | null {
  for (const timeZoneName of ['longOffset', 'shortOffset'] as const) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName,
        year: 'numeric',
      }).formatToParts(date)
      const parsed = parseGmtOffset(parts.find((part) => part.type === 'timeZoneName')?.value)

      if (parsed !== null) {
        return parsed
      }
    } catch {
      continue
    }
  }

  return null
}

function readZoneAbbr(timeZone: string, date: Date): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short',
      year: 'numeric',
    }).formatToParts(date)
    const text = clip(parts.find((part) => part.type === 'timeZoneName')?.value, 16)

    if (text === null || /^(?:GMT|UTC)[+-]/iu.test(text)) {
      return null
    }

    return text
  } catch {
    return null
  }
}

function parseGmtOffset(value: string | undefined): string | null {
  if (value === undefined) {
    return null
  }

  const trimmed = value.trim()

  if (/^(?:GMT|UTC)$/iu.test(trimmed)) {
    return '+00:00'
  }

  const match = trimmed.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/u)

  if (match === null) {
    return parseOffset(trimmed) === null ? null : trimmed
  }

  const hours = match[2]?.padStart(2, '0')
  const minutes = (match[3] ?? '00').padStart(2, '0')

  if (hours === undefined) {
    return null
  }

  return `${match[1]}${hours}:${minutes}`
}

function parseOffset(value: string): number | null {
  const match = value.trim().match(/^([+-])(\d{2}):(\d{2})$/u)

  if (match === null) {
    return null
  }

  const sign = match[1] === '-' ? -1 : 1
  const hours = Number(match[2])
  const minutes = Number(match[3])

  return sign * (hours * 60 + minutes)
}

function formatGeneratedAt(date: Date, offset: string | null): string {
  if (offset === null || parseOffset(offset) === null) {
    return date.toISOString()
  }

  const minutes = parseOffset(offset)

  if (minutes === null) {
    return date.toISOString()
  }

  const local = new Date(date.getTime() + minutes * 60_000)
  const pad = (value: number, size = 2): string => String(value).padStart(size, '0')

  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}.${pad(local.getUTCMilliseconds(), 3)}${offset}`
}

function deviceAndIpConflict(
  deviceCountryCode: string | null,
  ipCountryCode: string | null,
  deviceIana: string | null,
  ipIana: string | null,
): boolean {
  if (deviceCountryCode !== null && ipCountryCode !== null && deviceCountryCode !== ipCountryCode) {
    return true
  }

  return (
    deviceIana !== null &&
    ipIana !== null &&
    deviceIana !== ipIana &&
    lookupCountryFromIana(deviceIana)?.code !== lookupCountryFromIana(ipIana)?.code &&
    lookupCountryFromIana(deviceIana) !== null &&
    lookupCountryFromIana(ipIana) !== null
  )
}

function buildRegionReason(input: {
  readonly windowsHome: string | null
  readonly windowsId: string | null
  readonly ianaId: string | null
  readonly offset: string | null
  readonly abbr: string | null
  readonly now: Date
}): string {
  const parts: string[] = []

  if (input.windowsHome !== null) {
    parts.push(`Windows home location is ${input.windowsHome}`)
  }

  if (input.windowsId !== null) {
    const cityHint = input.ianaId?.split('/')[1]?.replaceAll('_', ' ')
    parts.push(
      cityHint === undefined
        ? `timezone is ${input.windowsId}`
        : `timezone is ${input.windowsId} (${cityHint})`,
    )
  } else if (input.ianaId !== null) {
    parts.push(`IANA timezone is ${input.ianaId}`)
  }

  if (input.offset !== null) {
    const dateLabel = formatDayMonth(input.now)
    const abbr = input.abbr

    if (abbr !== null && !/^(?:GMT|UTC)$/iu.test(abbr)) {
      parts.push(`session offset is UTC${input.offset}, which matches ${abbr} on ${dateLabel}`)
    } else {
      parts.push(`session offset is UTC${input.offset}`)
    }
  }

  if (parts.length === 0) {
    return 'Browser IANA timezone plus IP geolocation at login. Not GPS.'
  }

  return `${parts.join('; ')}.`
}

function buildEgressInterpretation(input: {
  readonly hosting: boolean
  readonly conflict: boolean
  readonly city: string | null
  readonly country: string | null
  readonly deviceCountry: string | null
  readonly offset: string | null
}): string {
  const place = [input.city, input.country]
    .filter((part): part is string => part !== null)
    .join(', ')

  if (input.hosting) {
    const where = place === '' ? 'the public IP' : place
    const conflict =
      input.conflict && input.deviceCountry !== null
        ? ` Conflicts with ${input.deviceCountry} device region${input.offset === null ? '' : ` and UTC${input.offset} session time`}.`
        : ''

    return `Datacenter/VPN/proxy egress in ${where}, not a residential address.${conflict}`
  }

  if (input.conflict && input.deviceCountry !== null) {
    const where = place === '' ? 'a different country' : place

    return `Public IP geolocation is ${where}. Conflicts with ${input.deviceCountry} device region${input.offset === null ? '' : ` and UTC${input.offset} session time`}.`
  }

  return 'Browser IP geolocation at login. May be VPN/datacenter egress, not the physical home address.'
}

function formatDayMonth(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date)
}

async function readIpGeo(fetchImpl: typeof fetch, timeoutMs: number): Promise<ICapturedNetworkGeo> {
  const empty = emptyGeo()
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetchImpl(LOGIN_GEO_URL, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    const raw = await response.text()

    if (!response.ok) {
      return empty
    }

    return parseGeojs(raw)
  } catch {
    return empty
  } finally {
    clearTimeout(timer)
  }
}

function parseGeojs(raw: string): ICapturedNetworkGeo {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    return emptyGeo()
  }

  if (parsed === null || typeof parsed !== 'object') {
    return emptyGeo()
  }

  const record = parsed as Record<string, unknown>
  const ip = clip(record['ip'], 45)
  const organization = clip(record['organization'], 128)
  const organizationName = clip(record['organization_name'], 128)

  return {
    ip,
    type: ipType(ip),
    city: clip(record['city'], 128),
    region: clip(record['region'], 128),
    regionCode: readRegionCode(record['region_code']),
    country: clip(record['country'], 128),
    countryCode: readCountryCode(record['country_code'] ?? record['country_code3']),
    continent: continentName(clip(record['continent_code'], 8)),
    postal: readPostal(record['postal'] ?? record['postal_code'] ?? record['zipcode']),
    latitude: readCoordinate(record['latitude'], -90, 90),
    longitude: readCoordinate(record['longitude'], -180, 180),
    timezone: clip(record['timezone'], 64),
    asn: readAsn(record['asn'], organization),
    org: organizationName ?? stripAsnPrefix(organization),
    isp: stripAsnPrefix(organization) ?? organizationName,
    domain: clip(record['domain'] ?? record['hostname'], 128),
  }
}

function emptyGeo(): ICapturedNetworkGeo {
  return {
    ip: null,
    type: null,
    city: null,
    region: null,
    regionCode: null,
    country: null,
    countryCode: null,
    continent: null,
    postal: null,
    latitude: null,
    longitude: null,
    timezone: null,
    asn: null,
    org: null,
    isp: null,
    domain: null,
  }
}

function ipType(ip: string | null): string | null {
  if (ip === null) {
    return null
  }

  if (ip.includes('.')) {
    return 'IPv4'
  }

  if (ip.includes(':')) {
    return 'IPv6'
  }

  return null
}

function readCoordinate(value: unknown, min: number, max: number): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN

  if (!Number.isFinite(number) || number < min || number > max) {
    return null
  }

  return number
}

function readAsn(value: unknown, organization: string | null): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN

  if (Number.isInteger(number) && number >= 0) {
    return number
  }

  const match = organization?.match(/^AS(\d+)/iu)?.[1]

  if (match === undefined) {
    return null
  }

  const fromOrg = Number(match)

  return Number.isInteger(fromOrg) ? fromOrg : null
}

function stripAsnPrefix(value: string | null): string | null {
  if (value === null) {
    return null
  }

  const stripped = value.replace(/^AS\d+\s+/iu, '').trim()

  return stripped === '' ? null : stripped.slice(0, 128)
}

function readCountryCode(value: unknown): string | null {
  const text = clip(value, 8)

  if (text === null) {
    return null
  }

  const code = text.toUpperCase()

  return /^[A-Z]{2,3}$/u.test(code) ? code : null
}

function readRegionCode(value: unknown): string | null {
  const text = clip(value, 16)

  if (text === null) {
    return null
  }

  const code = text.toUpperCase()

  return /^[A-Z0-9]{1,16}$/u.test(code) ? code : text
}

function readPostal(value: unknown): string | null {
  const text = clip(value, 16)

  if (text === null || text === '0') {
    return null
  }

  return text
}

function clip(value: unknown, max: number): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (trimmed === '') {
    return null
  }

  return trimmed.slice(0, max)
}
