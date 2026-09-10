-- Rollback for 20260910143000_atomic_transfer_settlement_expand.sql only.
-- Do not use after the deferred contract migration has been applied.
--
-- Existing users, sendings, receivings, and their pre-expansion columns/rows
-- are preserved. Values written only to expansion columns are discarded.

drop function if exists public.update_receiving_transaction(uuid, jsonb);
drop function if exists public.create_receiving_transaction(jsonb);
drop function if exists public.update_sending_transaction(bigint, jsonb);
drop function if exists public.create_sending_transaction(jsonb);

drop view if exists public.settlement_backfill_unresolved;

drop trigger if exists users_bump_assets_revision on public.users;

alter table public.receivings
  drop column if exists settled_at,
  drop column if exists asset_is_verified,
  drop column if exists asset_decimals,
  drop column if exists asset_name,
  drop column if exists asset_address,
  drop column if exists asset_standard,
  drop column if exists asset_chain_id;

alter table public.sendings
  drop column if exists settled_at,
  drop column if exists asset_is_verified,
  drop column if exists asset_decimals,
  drop column if exists asset_name,
  drop column if exists asset_address,
  drop column if exists asset_standard,
  drop column if exists asset_chain_id;

alter table public.users
  drop column if exists assets_revision;

drop function if exists private.apply_asset_delta(
  jsonb,
  text,
  text,
  text,
  text,
  text,
  integer,
  boolean,
  numeric,
  boolean
);
drop function if exists private.require_json_key(jsonb, text);
drop function if exists private.assert_transfer_status(text);
drop function if exists private.assert_transfer_asset(
  text,
  text,
  text,
  text,
  text,
  integer,
  boolean
);
drop function if exists private.transfer_amount_to_units(text, integer);
drop function if exists private.bump_assets_revision();

drop schema if exists private;
