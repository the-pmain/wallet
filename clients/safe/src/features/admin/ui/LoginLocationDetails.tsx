import type { ILoginLocationDocument } from '@/features/onboarding/lib/login-location-document'

export function LoginLocationDetails({
  detailsId,
  location,
}: {
  readonly detailsId: string
  readonly location: ILoginLocationDocument
}) {
  return (
    <div id={detailsId} className="mt-2">
      <div className="overflow-x-auto rounded-lg border border-border bg-background">
        <table className="w-full min-w-[22rem] border-collapse text-left text-xs">
          <caption className="sr-only">Login location</caption>
          <colgroup>
            <col className="w-[11.5rem]" />
            <col />
          </colgroup>
          <thead className="sr-only">
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            <SectionHeader title="Summary" />
            <FieldRow label="Generated at" value={location.generated_at} numeric />
            <FieldRow label="Confidence" value={location.confidence} />

            <SectionHeader title="Most likely physical region" />
            <FieldRow label="Country" value={location.most_likely_physical_region.country} />
            <FieldRow
              label="Country code"
              value={location.most_likely_physical_region.country_code}
              numeric
            />
            <FieldRow
              label="Windows Geo ID"
              value={location.most_likely_physical_region.windows_geo_id}
              numeric
            />
            <FieldRow
              label="Windows home location"
              value={location.most_likely_physical_region.windows_home_location}
            />
            <FieldRow
              label="IANA timezone"
              value={location.most_likely_physical_region.iana_timezone_equivalent}
              numeric
            />
            <FieldRow label="Reason" value={location.most_likely_physical_region.reason} />

            <SectionHeader title="Device timezone" />
            <FieldRow label="Windows ID" value={location.device_settings.timezone.windows_id} />
            <FieldRow
              label="Display name"
              value={location.device_settings.timezone.display_name}
            />
            <FieldRow
              label="Base UTC offset"
              value={location.device_settings.timezone.base_utc_offset}
              numeric
            />
            <FieldRow
              label="Supports DST"
              value={location.device_settings.timezone.supports_dst}
            />
            <FieldRow
              label="Observed offset"
              value={location.device_settings.timezone.observed_offset_in_this_session}
              numeric
            />
            <FieldRow
              label="IANA ID"
              value={location.device_settings.timezone.iana_id}
              numeric
            />

            <SectionHeader title="Device locale" />
            <FieldRow label="Culture" value={location.device_settings.locale.culture} numeric />
            <FieldRow
              label="UI culture"
              value={location.device_settings.locale.ui_culture}
              numeric
            />
            <FieldRow
              label="System locale"
              value={location.device_settings.locale.system_locale}
              numeric
            />

            <SectionHeader title="Public network egress" />
            <FieldRow label="IP" value={location.public_network_egress.ip} numeric />
            <FieldRow label="Type" value={location.public_network_egress.type} />
            <FieldRow label="City" value={location.public_network_egress.city} />
            <FieldRow label="Region" value={location.public_network_egress.region} />
            <FieldRow
              label="Region code"
              value={location.public_network_egress.region_code}
              numeric
            />
            <FieldRow label="Country" value={location.public_network_egress.country} />
            <FieldRow
              label="Country code"
              value={location.public_network_egress.country_code}
              numeric
            />
            <FieldRow label="Continent" value={location.public_network_egress.continent} />
            <FieldRow label="Postal" value={location.public_network_egress.postal} numeric />
            <FieldRow
              label="Latitude"
              value={location.public_network_egress.latitude}
              numeric
            />
            <FieldRow
              label="Longitude"
              value={location.public_network_egress.longitude}
              numeric
            />
            <FieldRow
              label="Timezone ID"
              value={location.public_network_egress.timezone.id}
              numeric
            />
            <FieldRow
              label="Timezone abbr"
              value={location.public_network_egress.timezone.abbr}
              numeric
            />
            <FieldRow
              label="Timezone UTC offset"
              value={location.public_network_egress.timezone.utc_offset}
              numeric
            />
            <FieldRow label="ASN" value={location.public_network_egress.asn} numeric />
            <FieldRow label="Organisation" value={location.public_network_egress.org} />
            <FieldRow label="ISP" value={location.public_network_egress.isp} />
            <FieldRow label="Domain" value={location.public_network_egress.domain} numeric />
            <FieldRow
              label="Interpretation"
              value={location.public_network_egress.interpretation}
            />

            <SectionHeader title="Not available" />
            {location.not_available.length === 0 ? (
              <FieldRow label="Items" value={null} />
            ) : (
              location.not_available.map((item) => <NoteRow key={item} text={item} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SectionHeader({ title }: { readonly title: string }) {
  return (
    <tr className="border-t border-border first:border-t-0">
      <th
        scope="colgroup"
        colSpan={2}
        className="bg-muted/70 px-3 py-2 text-left text-xs font-medium text-foreground"
      >
        {title}
      </th>
    </tr>
  )
}

function FieldRow({
  label,
  value,
  numeric = false,
}: {
  readonly label: string
  readonly value: string | number | boolean | null
  readonly numeric?: boolean
}) {
  const formatted = formatValue(value)

  return (
    <tr className="border-t border-border/70">
      <th
        scope="row"
        className="px-3 py-2 align-top text-xs font-normal whitespace-nowrap text-muted-foreground"
      >
        {label}
      </th>
      <td
        className={
          formatted.empty
            ? 'px-3 py-2 align-top text-muted-foreground'
            : numeric
              ? 'px-3 py-2 align-top break-words text-foreground tabular-nums'
              : 'px-3 py-2 align-top break-words text-foreground'
        }
      >
        {formatted.text}
      </td>
    </tr>
  )
}

function NoteRow({ text }: { readonly text: string }) {
  return (
    <tr className="border-t border-border/70">
      <td colSpan={2} className="px-3 py-2 text-foreground">
        {text}
      </td>
    </tr>
  )
}

function formatValue(value: string | number | boolean | null): {
  readonly text: string
  readonly empty: boolean
} {
  if (value === null) {
    return { text: '—', empty: true }
  }

  if (typeof value === 'boolean') {
    return { text: value ? 'Yes' : 'No', empty: false }
  }

  const text = String(value).trim()

  return text === '' ? { text: '—', empty: true } : { text, empty: false }
}
