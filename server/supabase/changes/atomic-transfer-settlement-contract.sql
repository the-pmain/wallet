-- DEFERRED CONTRACT MIGRATION. DO NOT APPLY WITH THE EXPAND MIGRATION.
--
-- Apply only after every production server uses the settlement RPCs and the
-- unresolved-backfill query returns no rows.

do $$
begin
  if exists (select 1 from public.settlement_backfill_unresolved) then
    raise exception
      'Settlement contract refused: unresolved transaction asset metadata remains.';
  end if;

  if exists (
    select 1
    from public.sendings
    where (status = 'success') is distinct from (settled_at is not null)
  ) then
    raise exception
      'Settlement contract refused: sendings status/settled_at invariant is not satisfied.';
  end if;

  if exists (
    select 1
    from public.receivings
    where (status = 'success') is distinct from (settled_at is not null)
  ) then
    raise exception
      'Settlement contract refused: receivings status/settled_at invariant is not satisfied.';
  end if;
end;
$$;

alter table public.sendings
  alter column asset_chain_id set not null,
  alter column asset_standard set not null,
  alter column asset_name set not null,
  alter column asset_decimals set not null,
  alter column asset_is_verified set not null;

alter table public.receivings
  alter column asset_chain_id set not null,
  alter column asset_standard set not null,
  alter column asset_name set not null,
  alter column asset_decimals set not null,
  alter column asset_is_verified set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sendings'::regclass
      and conname = 'sendings_asset_identity_check'
  ) then
    alter table public.sendings
      add constraint sendings_asset_identity_check check (
        asset_chain_id ~ '^[0-9]+$'
        and asset_standard in ('native', 'ERC-20')
        and asset_decimals between 0 and 36
        and (
          (asset_standard = 'native' and asset_address is null)
          or (
            asset_standard = 'ERC-20'
            and asset_address ~ '^0x[0-9A-Fa-f]{40}$'
          )
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sendings'::regclass
      and conname = 'sendings_settlement_state_check'
  ) then
    alter table public.sendings
      add constraint sendings_settlement_state_check check (
        (status = 'success') = (settled_at is not null)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.receivings'::regclass
      and conname = 'receivings_asset_identity_check'
  ) then
    alter table public.receivings
      add constraint receivings_asset_identity_check check (
        asset_chain_id ~ '^[0-9]+$'
        and asset_standard in ('native', 'ERC-20')
        and asset_decimals between 0 and 36
        and (
          (asset_standard = 'native' and asset_address is null)
          or (
            asset_standard = 'ERC-20'
            and asset_address ~ '^0x[0-9A-Fa-f]{40}$'
          )
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.receivings'::regclass
      and conname = 'receivings_settlement_state_check'
  ) then
    alter table public.receivings
      add constraint receivings_settlement_state_check check (
        (status = 'success') = (settled_at is not null)
      );
  end if;
end;
$$;

create or replace function private.guard_settlement_write()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if current_setting('app.settlement_rpc', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' and new.status is distinct from 'success' then
    return new;
  end if;

  raise exception 'Settlement fields may only be changed through a settlement RPC.'
    using errcode = '42501';
end;
$$;

drop trigger if exists sendings_guard_settlement_insert on public.sendings;
create trigger sendings_guard_settlement_insert
before insert on public.sendings
for each row
execute function private.guard_settlement_write();

drop trigger if exists sendings_guard_settlement_update on public.sendings;
create trigger sendings_guard_settlement_update
before update of
  user_id,
  status,
  recipient_address,
  amount,
  asset_symbol,
  asset_chain_id,
  asset_standard,
  asset_address,
  asset_name,
  asset_decimals,
  asset_is_verified,
  settled_at
on public.sendings
for each row
execute function private.guard_settlement_write();

drop trigger if exists receivings_guard_settlement_insert on public.receivings;
create trigger receivings_guard_settlement_insert
before insert on public.receivings
for each row
execute function private.guard_settlement_write();

drop trigger if exists receivings_guard_settlement_update on public.receivings;
create trigger receivings_guard_settlement_update
before update of
  user_id,
  status,
  recipient_address,
  amount,
  asset_symbol,
  usd_amount,
  asset_chain_id,
  asset_standard,
  asset_address,
  asset_name,
  asset_decimals,
  asset_is_verified,
  settled_at
on public.receivings
for each row
execute function private.guard_settlement_write();

-- SECURITY DEFINER RPCs continue to update as their owner. Direct service-role
-- settlement PATCHes are no longer allowed after the application cutover.
revoke update on table public.sendings from service_role;
revoke update on table public.receivings from service_role;
