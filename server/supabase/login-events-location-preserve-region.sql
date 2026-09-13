-- Paste in Supabase → SQL Editor → Run if login_events already has location.
-- Stops flattened IP country from overwriting most_likely_physical_region.

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
    );

    NEW.location := jsonb_set(
      NEW.location,
      '{public_network_egress,city}',
      coalesce(to_jsonb(v_city), 'null'::jsonb),
      true
    );
    NEW.location := jsonb_set(
      NEW.location,
      '{public_network_egress,region}',
      coalesce(to_jsonb(v_region), 'null'::jsonb),
      true
    );
    NEW.location := jsonb_set(
      NEW.location,
      '{public_network_egress,country}',
      coalesce(to_jsonb(v_country), 'null'::jsonb),
      true
    );
    NEW.location := jsonb_set(
      NEW.location,
      '{public_network_egress,country_code}',
      coalesce(to_jsonb(v_cc), 'null'::jsonb),
      true
    );

    if nullif(btrim(NEW.location #>> '{device_settings,timezone,iana_id}'), '') is null then
      NEW.location := jsonb_set(
        NEW.location,
        '{device_settings,timezone,iana_id}',
        coalesce(to_jsonb(v_tz), 'null'::jsonb),
        true
      );
    end if;

    if nullif(btrim(NEW.location #>> '{most_likely_physical_region,country}'), '') is null then
      NEW.location := jsonb_set(
        NEW.location,
        '{most_likely_physical_region,country}',
        coalesce(to_jsonb(v_country), 'null'::jsonb),
        true
      );
    end if;

    if nullif(btrim(NEW.location #>> '{most_likely_physical_region,country_code}'), '') is null then
      NEW.location := jsonb_set(
        NEW.location,
        '{most_likely_physical_region,country_code}',
        coalesce(to_jsonb(v_cc), 'null'::jsonb),
        true
      );
    end if;

    if nullif(
         btrim(NEW.location #>> '{most_likely_physical_region,iana_timezone_equivalent}'),
         ''
       ) is null then
      NEW.location := jsonb_set(
        NEW.location,
        '{most_likely_physical_region,iana_timezone_equivalent}',
        coalesce(to_jsonb(v_tz), 'null'::jsonb),
        true
      );
    end if;
  end if;

  NEW.time_zone := v_tz;
  NEW.city := v_city;
  NEW.region := v_region;
  NEW.country := v_country;
  NEW.country_code := v_cc;

  return NEW;
end;
$$;
