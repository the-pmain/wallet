/**
 * Browser cannot read Windows GeoID or tzutil. Map IANA / ISO onto the
 * nested login location document so the stored model is as complete as
 * a desktop location dump.
 */

export interface ICountryInfo {
  readonly code: string
  readonly name: string
  readonly geoId: number | null
}

export interface IWindowsZone {
  readonly windowsId: string
  readonly displayName: string
}

export const CONTINENT_NAMES: Record<string, string> = {
  AF: 'Africa',
  AN: 'Antarctica',
  AS: 'Asia',
  EU: 'Europe',
  NA: 'North America',
  OC: 'Oceania',
  SA: 'South America',
}

const COUNTRIES: Record<string, { name: string; geoId: number | null }> = {
  AE: { name: 'United Arab Emirates', geoId: 2 },
  AR: { name: 'Argentina', geoId: 11 },
  AT: { name: 'Austria', geoId: 14 },
  AU: { name: 'Australia', geoId: 12 },
  BE: { name: 'Belgium', geoId: 21 },
  BG: { name: 'Bulgaria', geoId: 35 },
  BR: { name: 'Brazil', geoId: 32 },
  CA: { name: 'Canada', geoId: 39 },
  CH: { name: 'Switzerland', geoId: 43 },
  CL: { name: 'Chile', geoId: 46 },
  CN: { name: 'China', geoId: 45 },
  CO: { name: 'Colombia', geoId: 51 },
  CY: { name: 'Cyprus', geoId: 59 },
  CZ: { name: 'Czechia', geoId: 56 },
  DE: { name: 'Germany', geoId: 94 },
  DK: { name: 'Denmark', geoId: 61 },
  EE: { name: 'Estonia', geoId: 70 },
  EG: { name: 'Egypt', geoId: 67 },
  ES: { name: 'Spain', geoId: 217 },
  FI: { name: 'Finland', geoId: 77 },
  FR: { name: 'France', geoId: 84 },
  GB: { name: 'United Kingdom', geoId: 242 },
  GR: { name: 'Greece', geoId: 98 },
  HK: { name: 'Hong Kong', geoId: 104 },
  HR: { name: 'Croatia', geoId: 108 },
  HU: { name: 'Hungary', geoId: 109 },
  ID: { name: 'Indonesia', geoId: 111 },
  IE: { name: 'Ireland', geoId: 68 },
  IL: { name: 'Israel', geoId: 117 },
  IN: { name: 'India', geoId: 113 },
  IS: { name: 'Iceland', geoId: 110 },
  IT: { name: 'Italy', geoId: 118 },
  JP: { name: 'Japan', geoId: 122 },
  KE: { name: 'Kenya', geoId: 129 },
  KR: { name: 'South Korea', geoId: 134 },
  LT: { name: 'Lithuania', geoId: 141 },
  LU: { name: 'Luxembourg', geoId: 147 },
  LV: { name: 'Latvia', geoId: 140 },
  MX: { name: 'Mexico', geoId: 166 },
  MY: { name: 'Malaysia', geoId: 167 },
  NG: { name: 'Nigeria', geoId: 175 },
  NL: { name: 'Netherlands', geoId: 176 },
  NO: { name: 'Norway', geoId: 177 },
  NZ: { name: 'New Zealand', geoId: 183 },
  PH: { name: 'Philippines', geoId: 201 },
  PK: { name: 'Pakistan', geoId: 184 },
  PL: { name: 'Poland', geoId: 191 },
  PT: { name: 'Portugal', geoId: 193 },
  RO: { name: 'Romania', geoId: 200 },
  RS: { name: 'Serbia', geoId: 271 },
  RU: { name: 'Russia', geoId: 203 },
  SA: { name: 'Saudi Arabia', geoId: 205 },
  SE: { name: 'Sweden', geoId: 221 },
  SG: { name: 'Singapore', geoId: 215 },
  SI: { name: 'Slovenia', geoId: 212 },
  SK: { name: 'Slovakia', geoId: 143 },
  TH: { name: 'Thailand', geoId: 227 },
  TR: { name: 'Türkiye', geoId: 235 },
  TW: { name: 'Taiwan', geoId: 237 },
  UA: { name: 'Ukraine', geoId: 241 },
  US: { name: 'United States', geoId: 244 },
  UY: { name: 'Uruguay', geoId: 246 },
  VN: { name: 'Vietnam', geoId: 251 },
  ZA: { name: 'South Africa', geoId: 209 },
}

const IANA_COUNTRY_CODE: Record<string, string> = {}
const IANA_WINDOWS: Record<string, IWindowsZone> = {}

indexCountry('GB', [
  'Europe/London',
  'Europe/Belfast',
  'Europe/Guernsey',
  'Europe/Isle_of_Man',
  'Europe/Jersey',
  'GB',
  'GB-Eire',
])
indexCountry('IE', ['Europe/Dublin', 'Eire'])
indexCountry('PT', ['Europe/Lisbon', 'Europe/Madeira', 'Atlantic/Azores', 'Portugal'])
indexCountry('BE', ['Europe/Brussels'])
indexCountry('FR', ['Europe/Paris', 'Europe/Monaco'])
indexCountry('NL', ['Europe/Amsterdam'])
indexCountry('LU', ['Europe/Luxembourg'])
indexCountry('DE', ['Europe/Berlin', 'Europe/Busingen'])
indexCountry('CH', ['Europe/Zurich'])
indexCountry('AT', ['Europe/Vienna'])
indexCountry('IT', ['Europe/Rome'])
indexCountry('ES', ['Europe/Madrid', 'Atlantic/Canary'])
indexCountry('DK', ['Europe/Copenhagen'])
indexCountry('SE', ['Europe/Stockholm'])
indexCountry('NO', ['Europe/Oslo'])
indexCountry('FI', ['Europe/Helsinki'])
indexCountry('PL', ['Europe/Warsaw'])
indexCountry('CZ', ['Europe/Prague'])
indexCountry('HU', ['Europe/Budapest'])
indexCountry('SK', ['Europe/Bratislava'])
indexCountry('SI', ['Europe/Ljubljana'])
indexCountry('HR', ['Europe/Zagreb'])
indexCountry('RO', ['Europe/Bucharest'])
indexCountry('BG', ['Europe/Sofia'])
indexCountry('GR', ['Europe/Athens'])
indexCountry('CY', ['Europe/Nicosia'])
indexCountry('EE', ['Europe/Tallinn'])
indexCountry('LV', ['Europe/Riga'])
indexCountry('LT', ['Europe/Vilnius'])
indexCountry('UA', ['Europe/Kyiv', 'Europe/Kiev'])
indexCountry('RU', ['Europe/Moscow'])
indexCountry('TR', ['Europe/Istanbul'])
indexCountry('IS', ['Atlantic/Reykjavik'])
indexCountry('US', [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Indiana/Indianapolis',
  'America/Detroit',
  'US/Eastern',
  'US/Central',
  'US/Mountain',
  'US/Pacific',
])
indexCountry('CA', [
  'America/Toronto',
  'America/Montreal',
  'America/Vancouver',
  'America/Edmonton',
  'America/Winnipeg',
  'America/Halifax',
  'America/St_Johns',
  'America/Whitehorse',
  'America/Regina',
  'Canada/Eastern',
  'Canada/Pacific',
])
indexCountry('MX', ['America/Mexico_City', 'America/Tijuana', 'America/Cancun'])
indexCountry('BR', ['America/Sao_Paulo', 'America/Fortaleza', 'America/Manaus'])
indexCountry('AR', ['America/Argentina/Buenos_Aires', 'America/Buenos_Aires'])
indexCountry('CL', ['America/Santiago'])
indexCountry('CO', ['America/Bogota'])
indexCountry('UY', ['America/Montevideo'])
indexCountry('AU', [
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Perth',
  'Australia/Adelaide',
  'Australia/Hobart',
  'Australia/Darwin',
])
indexCountry('NZ', ['Pacific/Auckland'])
indexCountry('JP', ['Asia/Tokyo'])
indexCountry('KR', ['Asia/Seoul'])
indexCountry('CN', ['Asia/Shanghai', 'Asia/Urumqi'])
indexCountry('HK', ['Asia/Hong_Kong'])
indexCountry('TW', ['Asia/Taipei'])
indexCountry('SG', ['Asia/Singapore'])
indexCountry('IN', ['Asia/Kolkata', 'Asia/Calcutta'])
indexCountry('TH', ['Asia/Bangkok'])
indexCountry('VN', ['Asia/Ho_Chi_Minh', 'Asia/Saigon'])
indexCountry('ID', ['Asia/Jakarta'])
indexCountry('MY', ['Asia/Kuala_Lumpur'])
indexCountry('PH', ['Asia/Manila'])
indexCountry('PK', ['Asia/Karachi'])
indexCountry('AE', ['Asia/Dubai'])
indexCountry('SA', ['Asia/Riyadh'])
indexCountry('IL', ['Asia/Jerusalem'])
indexCountry('ZA', ['Africa/Johannesburg'])
indexCountry('EG', ['Africa/Cairo'])
indexCountry('NG', ['Africa/Lagos'])
indexCountry('KE', ['Africa/Nairobi'])

indexWindows('GMT Standard Time', '(UTC+00:00) Dublin, Edinburgh, Lisbon, London', [
  'Europe/London',
  'Europe/Belfast',
  'Europe/Guernsey',
  'Europe/Isle_of_Man',
  'Europe/Jersey',
  'Europe/Dublin',
  'Europe/Lisbon',
  'Europe/Madeira',
  'GMT',
  'GB',
  'GB-Eire',
  'Eire',
  'Portugal',
])
indexWindows('UTC', '(UTC) Coordinated Universal Time', [
  'UTC',
  'Etc/UTC',
  'Etc/GMT',
  'Etc/GMT+0',
  'Etc/GMT-0',
])
indexWindows('Romance Standard Time', '(UTC+01:00) Brussels, Copenhagen, Madrid, Paris', [
  'Europe/Paris',
  'Europe/Brussels',
  'Europe/Copenhagen',
  'Europe/Madrid',
  'Europe/Monaco',
])
indexWindows(
  'W. Europe Standard Time',
  '(UTC+01:00) Amsterdam, Berlin, Bern, Rome, Stockholm, Vienna',
  [
    'Europe/Amsterdam',
    'Europe/Berlin',
    'Europe/Busingen',
    'Europe/Rome',
    'Europe/Stockholm',
    'Europe/Vienna',
    'Europe/Zurich',
    'Europe/Luxembourg',
    'Europe/Oslo',
  ],
)
indexWindows(
  'Central Europe Standard Time',
  '(UTC+01:00) Belgrade, Bratislava, Budapest, Ljubljana, Prague',
  ['Europe/Prague', 'Europe/Budapest', 'Europe/Bratislava', 'Europe/Ljubljana', 'Europe/Belgrade'],
)
indexWindows('Central European Standard Time', '(UTC+01:00) Sarajevo, Skopje, Warsaw, Zagreb', [
  'Europe/Warsaw',
  'Europe/Zagreb',
])
indexWindows('GTB Standard Time', '(UTC+02:00) Athens, Bucharest', [
  'Europe/Athens',
  'Europe/Bucharest',
])
indexWindows('FLE Standard Time', '(UTC+02:00) Helsinki, Kyiv, Riga, Sofia, Tallinn, Vilnius', [
  'Europe/Helsinki',
  'Europe/Kyiv',
  'Europe/Kiev',
  'Europe/Riga',
  'Europe/Sofia',
  'Europe/Tallinn',
  'Europe/Vilnius',
])
indexWindows('E. Europe Standard Time', '(UTC+02:00) Chisinau', ['Europe/Chisinau'])
indexWindows('Turkey Standard Time', '(UTC+03:00) Istanbul', ['Europe/Istanbul'])
indexWindows('Russian Standard Time', '(UTC+03:00) Moscow, St. Petersburg', ['Europe/Moscow'])
indexWindows('Greenwich Standard Time', '(UTC+00:00) Monrovia, Reykjavik', ['Atlantic/Reykjavik'])
indexWindows('Azores Standard Time', '(UTC-01:00) Azores', ['Atlantic/Azores'])
indexWindows('Eastern Standard Time', '(UTC-05:00) Eastern Time (US & Canada)', [
  'America/New_York',
  'America/Detroit',
  'America/Indiana/Indianapolis',
  'America/Toronto',
  'America/Montreal',
  'Canada/Eastern',
  'US/Eastern',
])
indexWindows('Central Standard Time', '(UTC-06:00) Central Time (US & Canada)', [
  'America/Chicago',
  'America/Winnipeg',
  'US/Central',
])
indexWindows('Mountain Standard Time', '(UTC-07:00) Mountain Time (US & Canada)', [
  'America/Denver',
  'America/Edmonton',
  'US/Mountain',
])
indexWindows('US Mountain Standard Time', '(UTC-07:00) Arizona', ['America/Phoenix'])
indexWindows('Pacific Standard Time', '(UTC-08:00) Pacific Time (US & Canada)', [
  'America/Los_Angeles',
  'America/Vancouver',
  'America/Tijuana',
  'US/Pacific',
  'Canada/Pacific',
])
indexWindows('Alaskan Standard Time', '(UTC-09:00) Alaska', ['America/Anchorage'])
indexWindows('Hawaiian Standard Time', '(UTC-10:00) Hawaii', ['Pacific/Honolulu'])
indexWindows('Atlantic Standard Time', '(UTC-04:00) Atlantic Time (Canada)', ['America/Halifax'])
indexWindows('Newfoundland Standard Time', '(UTC-03:30) Newfoundland', ['America/St_Johns'])
indexWindows('Central Standard Time (Mexico)', '(UTC-06:00) Guadalajara, Mexico City, Monterrey', [
  'America/Mexico_City',
])
indexWindows('SA Pacific Standard Time', '(UTC-05:00) Bogota, Lima, Quito, Rio Branco', [
  'America/Bogota',
])
indexWindows('E. South America Standard Time', '(UTC-03:00) Brasilia', ['America/Sao_Paulo'])
indexWindows('Argentina Standard Time', '(UTC-03:00) City of Buenos Aires', [
  'America/Argentina/Buenos_Aires',
  'America/Buenos_Aires',
])
indexWindows('Pacific SA Standard Time', '(UTC-04:00) Santiago', ['America/Santiago'])
indexWindows('AUS Eastern Standard Time', '(UTC+10:00) Canberra, Melbourne, Sydney', [
  'Australia/Sydney',
  'Australia/Melbourne',
])
indexWindows('E. Australia Standard Time', '(UTC+10:00) Brisbane', ['Australia/Brisbane'])
indexWindows('W. Australia Standard Time', '(UTC+08:00) Perth', ['Australia/Perth'])
indexWindows('Cen. Australia Standard Time', '(UTC+09:30) Adelaide', ['Australia/Adelaide'])
indexWindows('Tasmania Standard Time', '(UTC+10:00) Hobart', ['Australia/Hobart'])
indexWindows('AUS Central Standard Time', '(UTC+09:30) Darwin', ['Australia/Darwin'])
indexWindows('New Zealand Standard Time', '(UTC+12:00) Auckland, Wellington', ['Pacific/Auckland'])
indexWindows('Tokyo Standard Time', '(UTC+09:00) Osaka, Sapporo, Tokyo', ['Asia/Tokyo'])
indexWindows('Korea Standard Time', '(UTC+09:00) Seoul', ['Asia/Seoul'])
indexWindows('China Standard Time', '(UTC+08:00) Beijing, Chongqing, Hong Kong, Urumqi', [
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Urumqi',
])
indexWindows('Taipei Standard Time', '(UTC+08:00) Taipei', ['Asia/Taipei'])
indexWindows('Singapore Standard Time', '(UTC+08:00) Kuala Lumpur, Singapore', [
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
])
indexWindows('India Standard Time', '(UTC+05:30) Chennai, Kolkata, Mumbai, New Delhi', [
  'Asia/Kolkata',
  'Asia/Calcutta',
])
indexWindows('SE Asia Standard Time', '(UTC+07:00) Bangkok, Hanoi, Jakarta', [
  'Asia/Bangkok',
  'Asia/Ho_Chi_Minh',
  'Asia/Saigon',
  'Asia/Jakarta',
])
indexWindows('Singapore Standard Time', '(UTC+08:00) Kuala Lumpur, Singapore', ['Asia/Manila'])
indexWindows('Pakistan Standard Time', '(UTC+05:00) Islamabad, Karachi', ['Asia/Karachi'])
indexWindows('Arabian Standard Time', '(UTC+04:00) Abu Dhabi, Muscat', ['Asia/Dubai'])
indexWindows('Arab Standard Time', '(UTC+03:00) Kuwait, Riyadh', ['Asia/Riyadh'])
indexWindows('Israel Standard Time', '(UTC+02:00) Jerusalem', ['Asia/Jerusalem'])
indexWindows('South Africa Standard Time', '(UTC+02:00) Harare, Pretoria', ['Africa/Johannesburg'])
indexWindows('Egypt Standard Time', '(UTC+02:00) Cairo', ['Africa/Cairo'])
indexWindows('W. Central Africa Standard Time', '(UTC+01:00) West Central Africa', ['Africa/Lagos'])
indexWindows('E. Africa Standard Time', '(UTC+03:00) Nairobi', ['Africa/Nairobi'])

const DATACENTER_HINT =
  /gthost|globaltelehost|digitalocean|linode|vultr|hetzner|ovh\b|leaseweb|choopa|datacamp|m247|quadranet|psychz|colocrossing|hostinger|contabo|akamai|fastly|cloudflare|amazon|aws\b|azure|google cloud|\bgcp\b|oracle cloud|alibaba|tencent|softlayer|ibm cloud|digital ocean|colocrossing/iu

export function continentName(code: string | null): string | null {
  if (code === null) {
    return null
  }

  const upper = code.trim().toUpperCase()

  if (upper === '') {
    return null
  }

  return CONTINENT_NAMES[upper] ?? clipText(code, 64)
}

export function lookupCountry(code: string | null): ICountryInfo | null {
  if (code === null) {
    return null
  }

  const upper = code.trim().toUpperCase()
  const row = COUNTRIES[upper]

  if (row === undefined) {
    return null
  }

  return { code: upper, name: row.name, geoId: row.geoId }
}

export function lookupCountryFromIana(iana: string | null): ICountryInfo | null {
  if (iana === null) {
    return null
  }

  const code = IANA_COUNTRY_CODE[iana]

  if (code === undefined) {
    return null
  }

  return lookupCountry(code)
}

export function lookupWindowsZone(iana: string | null): IWindowsZone | null {
  if (iana === null) {
    return null
  }

  return IANA_WINDOWS[iana] ?? null
}

export function looksLikeDatacenterEgress(org: string | null, isp: string | null): boolean {
  return DATACENTER_HINT.test(`${org ?? ''} ${isp ?? ''}`)
}

function indexCountry(code: string, ianaIds: readonly string[]): void {
  for (const id of ianaIds) {
    IANA_COUNTRY_CODE[id] = code
  }
}

function indexWindows(windowsId: string, displayName: string, ianaIds: readonly string[]): void {
  const zone: IWindowsZone = { windowsId, displayName }

  for (const id of ianaIds) {
    IANA_WINDOWS[id] = zone
  }
}

function clipText(value: string, max: number): string {
  const trimmed = value.trim()

  return trimmed === '' ? '' : trimmed.slice(0, max)
}
