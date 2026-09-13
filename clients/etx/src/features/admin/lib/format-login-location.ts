/**
 * Place line for a cabinet login row.
 *
 * Reads only `login_events.location`. Prefer the public IP city/country.
 * Timezone is the fallback when the document has no place name.
 */
import type { ILoginLocationDocument } from '@/features/onboarding/lib/login-location-document'

export function formatLoginLocation(location: ILoginLocationDocument | null): string | null {
  if (location === null) {
    return null
  }

  const city = emptyToNull(location.public_network_egress.city)
  const country =
    emptyToNull(location.public_network_egress.country) ??
    emptyToNull(location.most_likely_physical_region.country)
  const region = emptyToNull(location.public_network_egress.region)

  if (city !== null && country !== null) {
    return `${city}, ${country}`
  }

  if (city !== null) {
    return city
  }

  if (region !== null && country !== null) {
    return `${region}, ${country}`
  }

  if (country !== null) {
    return country
  }

  const code =
    emptyToNull(location.public_network_egress.country_code) ??
    emptyToNull(location.most_likely_physical_region.country_code)

  if (code !== null) {
    return code
  }

  return (
    emptyToNull(location.device_settings.timezone.iana_id) ??
    emptyToNull(location.most_likely_physical_region.iana_timezone_equivalent)
  )
}

function emptyToNull(value: string | null): string | null {
  if (value === null) {
    return null
  }

  const trimmed = value.trim()

  return trimmed === '' ? null : trimmed
}
