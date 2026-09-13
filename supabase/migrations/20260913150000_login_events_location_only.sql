-- Flattened login_events columns are retired. location jsonb is the
-- only place document.

drop trigger if exists login_events_sync_location on public.login_events;

drop function if exists public.login_events_sync_location();
drop function if exists public.login_events_build_location(timestamp with time zone, text, text, text, text, text);
drop function if exists public.login_events_is_complete_location(jsonb);
drop function if exists public.login_events_normalize_country_code(text);

alter table public.login_events
  drop column if exists time_zone,
  drop column if exists city,
  drop column if exists region,
  drop column if exists country,
  drop column if exists country_code;

comment on column public.login_events.location is
  'Full login location document. Nested model: most_likely_physical_region, device_settings, public_network_egress. Not GPS. This is the only place field.';
