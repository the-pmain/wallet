-- Add public.login_events.location jsonb and keep the flattened
-- time_zone/city/region/country/country_code columns in sync.

alter table public.login_events
  add column if not exists time_zone text,
  add column if not exists city text,
  add column if not exists region text,
  add column if not exists country text,
  add column if not exists country_code text,
  add column if not exists location jsonb;

comment on column public.login_events.time_zone is
  'IANA timezone from the browser (Intl), e.g. Europe/London.';
comment on column public.login_events.city is
  'City from browser IP geolocation at login.';
comment on column public.login_events.region is
  'Region / state from browser IP geolocation at login.';
comment on column public.login_events.country is
  'Country name from browser IP geolocation at login.';
comment on column public.login_events.country_code is
  'ISO 3166-1 alpha-2 country code from browser IP geolocation at login.';
comment on column public.login_events.location is
  'Full login location document. Nested model: most_likely_physical_region, device_settings, public_network_egress. Not GPS. Existing time_zone/city/region/country/country_code are flattened projections of this document and must stay in sync.';

create or replace function public.login_events_normalize_country_code(p_code text)
returns text
language sql
immutable
as $$
  select case
    when p_code is null then null
    when upper(btrim(p_code)) ~ '^[A-Z]{2,3}$' then upper(btrim(p_code))
    else null
  end;
$$;

create or replace function public.login_events_is_complete_location(p_location jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(p_location) = 'object'
    and p_location ? 'generated_at'
    and p_location ? 'confidence'
    and p_location ? 'most_likely_physical_region'
    and p_location ? 'device_settings'
    and p_location ? 'public_network_egress'
    and p_location ? 'not_available';
$$;

create or replace function public.login_events_build_location(
  p_created_at timestamp with time zone,
  p_time_zone text,
  p_city text,
  p_region text,
  p_country text,
  p_country_code text
)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_tz text := nullif(btrim(p_time_zone), '');
  v_city text := nullif(btrim(p_city), '');
  v_region text := nullif(btrim(p_region), '');
  v_country text := nullif(btrim(p_country), '');
  v_cc text := public.login_events_normalize_country_code(p_country_code);
  v_captured boolean :=
    v_tz is not null
    or v_city is not null
    or v_region is not null
    or v_country is not null
    or v_cc is not null;
  v_confidence text := case
    when v_captured then
      'region-level from browser at login; IANA timezone from Intl; city/region/country from IP geolocation; not GPS; IP may be VPN/datacenter'
    else
      'no location captured at login'
  end;
begin
  return jsonb_build_object(
    'generated_at', to_char(p_created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'confidence', v_confidence,
    'most_likely_physical_region', jsonb_build_object(
      'country', coalesce(to_jsonb(v_country), 'null'::jsonb),
      'country_code', coalesce(to_jsonb(v_cc), 'null'::jsonb),
      'windows_geo_id', 'null'::jsonb,
      'windows_home_location', 'null'::jsonb,
      'iana_timezone_equivalent', coalesce(to_jsonb(v_tz), 'null'::jsonb),
      'reason', 'Browser IANA timezone plus IP geolocation at login. Not GPS.'
    ),
    'device_settings', jsonb_build_object(
      'timezone', jsonb_build_object(
        'windows_id', 'null'::jsonb,
        'display_name', 'null'::jsonb,
        'base_utc_offset', 'null'::jsonb,
        'supports_dst', 'null'::jsonb,
        'observed_offset_in_this_session', 'null'::jsonb,
        'iana_id', coalesce(to_jsonb(v_tz), 'null'::jsonb)
      ),
      'locale', jsonb_build_object(
        'culture', 'null'::jsonb,
        'ui_culture', 'null'::jsonb,
        'system_locale', 'null'::jsonb
      )
    ),
    'public_network_egress', jsonb_build_object(
      'ip', 'null'::jsonb,
      'type', 'null'::jsonb,
      'city', coalesce(to_jsonb(v_city), 'null'::jsonb),
      'region', coalesce(to_jsonb(v_region), 'null'::jsonb),
      'region_code', 'null'::jsonb,
      'country', coalesce(to_jsonb(v_country), 'null'::jsonb),
      'country_code', coalesce(to_jsonb(v_cc), 'null'::jsonb),
      'continent', 'null'::jsonb,
      'postal', 'null'::jsonb,
      'latitude', 'null'::jsonb,
      'longitude', 'null'::jsonb,
      'timezone', jsonb_build_object(
        'id', coalesce(to_jsonb(v_tz), 'null'::jsonb),
        'abbr', 'null'::jsonb,
        'utc_offset', 'null'::jsonb
      ),
      'asn', 'null'::jsonb,
      'org', 'null'::jsonb,
      'isp', 'null'::jsonb,
      'domain', 'null'::jsonb,
      'interpretation', 'Browser IP geolocation at login. May be VPN/datacenter egress, not the physical home address.'
    ),
    'not_available', jsonb_build_array(
      'GPS / Wi-Fi / cell triangulation',
      'street address or postcode of the physical user',
      'indoor coordinates',
      'device location-services consent payload'
    )
  );
end;
$$;

create or replace function public.login_events_sync_location()
returns trigger
language plpgsql
as $$
declare
  v_tz text;
  v_city text;
  v_region text;
  v_country text;
  v_cc text;
begin
  v_tz := nullif(btrim(NEW.time_zone), '');
  v_city := nullif(btrim(NEW.city), '');
  v_region := nullif(btrim(NEW.region), '');
  v_country := nullif(btrim(NEW.country), '');
  v_cc := public.login_events_normalize_country_code(NEW.country_code);

  if NEW.location is null
     or not coalesce(public.login_events_is_complete_location(NEW.location), false) then
    NEW.location := public.login_events_build_location(
      coalesce(NEW.created_at, now()),
      v_tz,
      v_city,
      v_region,
      v_country,
      v_cc
    );
  else
    if v_tz is null then
      v_tz := nullif(btrim(NEW.location #>> '{device_settings,timezone,iana_id}'), '');
    end if;
    if v_tz is null then
      v_tz := nullif(
        btrim(NEW.location #>> '{most_likely_physical_region,iana_timezone_equivalent}'),
        ''
      );
    end if;
    if v_tz is null then
      v_tz := nullif(btrim(NEW.location #>> '{public_network_egress,timezone,id}'), '');
    end if;
    if v_city is null then
      v_city := nullif(btrim(NEW.location #>> '{public_network_egress,city}'), '');
    end if;
    if v_region is null then
      v_region := nullif(btrim(NEW.location #>> '{public_network_egress,region}'), '');
    end if;
    if v_country is null then
      v_country := coalesce(
        nullif(btrim(NEW.location #>> '{public_network_egress,country}'), ''),
        nullif(btrim(NEW.location #>> '{most_likely_physical_region,country}'), '')
      );
    end if;
    if v_cc is null then
      v_cc := public.login_events_normalize_country_code(
        coalesce(
          NEW.location #>> '{public_network_egress,country_code}',
          NEW.location #>> '{most_likely_physical_region,country_code}'
        )
      );
    end if;

    NEW.location := jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  NEW.location,
                  '{generated_at}',
                  to_jsonb(
                    coalesce(
                      nullif(btrim(NEW.location ->> 'generated_at'), ''),
                      to_char(
                        coalesce(NEW.created_at, now()) at time zone 'UTC',
                        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                      )
                    )
                  ),
                  true
                ),
                '{most_likely_physical_region,country}',
                coalesce(to_jsonb(v_country), 'null'::jsonb),
                true
              ),
              '{most_likely_physical_region,country_code}',
              coalesce(to_jsonb(v_cc), 'null'::jsonb),
              true
            ),
            '{device_settings,timezone,iana_id}',
            coalesce(to_jsonb(v_tz), 'null'::jsonb),
            true
          ),
          '{public_network_egress,city}',
          coalesce(to_jsonb(v_city), 'null'::jsonb),
          true
        ),
        '{public_network_egress,region}',
        coalesce(to_jsonb(v_region), 'null'::jsonb),
        true
      ),
      '{public_network_egress,country}',
      coalesce(to_jsonb(v_country), 'null'::jsonb),
      true
    );
    NEW.location := jsonb_set(
      jsonb_set(
        NEW.location,
        '{public_network_egress,country_code}',
        coalesce(to_jsonb(v_cc), 'null'::jsonb),
        true
      ),
      '{most_likely_physical_region,iana_timezone_equivalent}',
      coalesce(
        to_jsonb(coalesce(
          nullif(btrim(NEW.location #>> '{most_likely_physical_region,iana_timezone_equivalent}'), ''),
          v_tz
        )),
        'null'::jsonb
      ),
      true
    );
  end if;

  NEW.time_zone := v_tz;
  NEW.city := v_city;
  NEW.region := v_region;
  NEW.country := v_country;
  NEW.country_code := v_cc;

  return NEW;
end;
$$;

drop trigger if exists login_events_sync_location on public.login_events;
create trigger login_events_sync_location
  before insert or update on public.login_events
  for each row
  execute function public.login_events_sync_location();

update public.login_events
set location = public.login_events_build_location(
  created_at,
  time_zone,
  city,
  region,
  country,
  country_code
)
where location is null
   or jsonb_typeof(location) <> 'object'
   or location = '{}'::jsonb
   or not public.login_events_is_complete_location(location);

alter table public.login_events
  alter column location set default '{}'::jsonb;

alter table public.login_events
  alter column location set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'login_events_location_object_chk'
      and conrelid = 'public.login_events'::regclass
  ) then
    alter table public.login_events
      add constraint login_events_location_object_chk
      check (jsonb_typeof(location) = 'object');
  end if;
end;
$$;
