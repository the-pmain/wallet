-- Backward-compatible expansion for atomic sending/receiving settlement.
--
-- This migration deliberately keeps legacy REST INSERT/PATCH access working.
-- Enforcement belongs to the deferred contract migration after every server
-- instance uses the RPCs below.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.users
  add column if not exists assets_revision bigint not null default 0;

alter table public.sendings
  add column if not exists asset_chain_id text,
  add column if not exists asset_standard text,
  add column if not exists asset_address text,
  add column if not exists asset_name text,
  add column if not exists asset_decimals integer,
  add column if not exists asset_is_verified boolean,
  add column if not exists settled_at timestamp with time zone;

alter table public.receivings
  add column if not exists asset_chain_id text,
  add column if not exists asset_standard text,
  add column if not exists asset_address text,
  add column if not exists asset_name text,
  add column if not exists asset_decimals integer,
  add column if not exists asset_is_verified boolean,
  add column if not exists settled_at timestamp with time zone;

comment on column public.users.assets_revision is
  'Optimistic revision incremented whenever users.assets changes.';
comment on column public.sendings.settled_at is
  'Non-null when the sending debit is currently applied.';
comment on column public.receivings.settled_at is
  'Non-null when the receiving credit is currently applied.';

create or replace function private.bump_assets_revision()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.assets is distinct from old.assets then
    new.assets_revision := old.assets_revision + 1;
  end if;

  return new;
end;
$$;

drop trigger if exists users_bump_assets_revision on public.users;
create trigger users_bump_assets_revision
before update of assets on public.users
for each row
execute function private.bump_assets_revision();

-- Convert a human decimal amount to an integer in the asset's smallest unit.
create or replace function private.transfer_amount_to_units(
  p_amount text,
  p_decimals integer
)
returns numeric
language plpgsql
immutable
strict
set search_path = pg_catalog
as $$
declare
  v_parts text[];
  v_fraction text;
begin
  if p_decimals < 0 or p_decimals > 36 then
    raise exception 'Asset decimals must be between 0 and 36.'
      using errcode = '22023';
  end if;

  if p_amount !~ '^[0-9]+(\.[0-9]+)?$' then
    raise exception 'Amount must be a decimal string.'
      using errcode = '22023';
  end if;

  v_parts := string_to_array(p_amount, '.');
  v_fraction := coalesce(v_parts[2], '');

  if length(v_fraction) > p_decimals then
    raise exception 'Amount has more fractional digits than the asset supports.'
      using errcode = '22023';
  end if;

  return (v_parts[1] || rpad(v_fraction, p_decimals, '0'))::numeric;
end;
$$;

create or replace function private.assert_transfer_asset(
  p_chain_id text,
  p_standard text,
  p_address text,
  p_symbol text,
  p_name text,
  p_decimals integer,
  p_is_verified boolean
)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if p_chain_id is null or p_chain_id !~ '^[0-9]+$' then
    raise exception 'Asset chain id must be a numeric string.'
      using errcode = '22023';
  end if;

  if p_standard not in ('native', 'ERC-20') then
    raise exception 'Asset standard must be native or ERC-20.'
      using errcode = '22023';
  end if;

  if p_standard = 'native' and p_address is not null then
    raise exception 'Native assets must not have a contract address.'
      using errcode = '22023';
  end if;

  if p_standard = 'ERC-20' and (
    p_address is null or p_address !~ '^0x[0-9A-Fa-f]{40}$'
  ) then
    raise exception 'ERC-20 assets require a 42-character contract address.'
      using errcode = '22023';
  end if;

  if p_symbol is null or btrim(p_symbol) = '' or length(p_symbol) > 32 then
    raise exception 'Asset symbol is required.'
      using errcode = '22023';
  end if;

  if p_name is null or btrim(p_name) = '' or length(p_name) > 128 then
    raise exception 'Asset name is required.'
      using errcode = '22023';
  end if;

  if p_decimals is null or p_decimals < 0 or p_decimals > 36 then
    raise exception 'Asset decimals must be between 0 and 36.'
      using errcode = '22023';
  end if;

  if p_is_verified is null then
    raise exception 'Asset verification flag is required.'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function private.assert_transfer_status(p_status text)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if p_status not in ('pending', 'success', 'failure') then
    raise exception 'Status must be pending, success, or failure.'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function private.require_json_key(
  p_input jsonb,
  p_key text
)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object' or not (p_input ? p_key) then
    raise exception 'RPC input is missing required field: %', p_key
      using errcode = '22023';
  end if;
end;
$$;

-- Apply a signed smallest-unit delta while preserving token order and metadata.
-- Positive deltas may append the supplied token when p_allow_create is true.
create or replace function private.apply_asset_delta(
  p_assets jsonb,
  p_chain_id text,
  p_standard text,
  p_address text,
  p_symbol text,
  p_name text,
  p_decimals integer,
  p_is_verified boolean,
  p_delta numeric,
  p_allow_create boolean
)
returns jsonb
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_assets jsonb;
  v_tokens jsonb;
  v_next_tokens jsonb := '[]'::jsonb;
  v_token jsonb;
  v_balance_text text;
  v_next_balance numeric;
  v_found boolean := false;
begin
  perform private.assert_transfer_asset(
    p_chain_id,
    p_standard,
    p_address,
    p_symbol,
    p_name,
    p_decimals,
    p_is_verified
  );

  if p_delta is null or trunc(p_delta) <> p_delta then
    raise exception 'Asset delta must be an integer.'
      using errcode = '22023';
  end if;

  v_assets := case
    when jsonb_typeof(p_assets) = 'object' then p_assets
    else jsonb_build_object(
      'quoteCurrency', 'USD',
      'updatedAt', to_char(clock_timestamp(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'tokens', '[]'::jsonb
    )
  end;
  v_tokens := coalesce(v_assets -> 'tokens', '[]'::jsonb);

  if jsonb_typeof(v_tokens) <> 'array' then
    raise exception 'User assets.tokens must be an array.'
      using errcode = '22023';
  end if;

  for v_token in
    select value
    from jsonb_array_elements(v_tokens)
  loop
    if
      v_token ->> 'chainId' = p_chain_id
      and v_token ->> 'standard' = p_standard
      and (
        (p_address is null and v_token ->> 'address' is null)
        or (
          p_address is not null
          and lower(v_token ->> 'address') = lower(p_address)
        )
      )
    then
      if v_found then
        raise exception 'User assets contain duplicate entries for the same asset.'
          using errcode = '23514';
      end if;

      v_balance_text := v_token ->> 'balance';

      if v_balance_text is null or v_balance_text !~ '^[0-9]+$' then
        raise exception 'Stored asset balance must be a non-negative integer string.'
          using errcode = '23514';
      end if;

      v_next_balance := v_balance_text::numeric + p_delta;

      if v_next_balance < 0 then
        raise exception 'Insufficient asset balance or inconsistent reversal.'
          using errcode = '23514';
      end if;

      v_token := jsonb_set(
        v_token,
        '{balance}',
        to_jsonb(trunc(v_next_balance)::text),
        true
      );
      v_found := true;
    end if;

    v_next_tokens := v_next_tokens || jsonb_build_array(v_token);
  end loop;

  if not v_found then
    if p_delta < 0 or not p_allow_create then
      raise exception 'Asset was not found in the user portfolio.'
        using errcode = '23514';
    end if;

    v_next_tokens := v_next_tokens || jsonb_build_array(
      jsonb_build_object(
        'chainId', p_chain_id,
        'standard', p_standard,
        'address', p_address,
        'symbol', btrim(p_symbol),
        'name', btrim(p_name),
        'decimals', p_decimals,
        'balance', trunc(p_delta)::text,
        'isVerified', p_is_verified
      )
    );
  end if;

  v_assets := jsonb_set(v_assets, '{quoteCurrency}', to_jsonb('USD'::text), true);
  v_assets := jsonb_set(v_assets, '{tokens}', v_next_tokens, true);
  v_assets := jsonb_set(
    v_assets,
    '{updatedAt}',
    to_jsonb(to_char(clock_timestamp(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    true
  );

  return v_assets;
end;
$$;

-- Best-effort metadata backfill from each transaction owner's current portfolio.
with candidates as (
  select distinct on (s.id)
    s.id,
    token
  from public.sendings s
  join public.users u on u.id::text = s.user_id
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(u.assets -> 'tokens') = 'array' then u.assets -> 'tokens'
      else '[]'::jsonb
    end
  ) token
  where s.asset_chain_id is null
    and upper(token ->> 'symbol') = upper(s.asset_symbol)
    and token ->> 'chainId' ~ '^[0-9]+$'
    and token ->> 'standard' in ('native', 'ERC-20')
    and coalesce(token ->> 'name', '') <> ''
    and token ->> 'decimals' ~ '^(?:[0-9]|[12][0-9]|3[0-6])$'
    and token ->> 'isVerified' in ('true', 'false')
    and (
      (token ->> 'standard' = 'native' and token ->> 'address' is null)
      or (
        token ->> 'standard' = 'ERC-20'
        and token ->> 'address' ~ '^0x[0-9A-Fa-f]{40}$'
      )
    )
  order by s.id, case when token ->> 'chainId' = '1' then 0 else 1 end
)
update public.sendings s
set
  asset_chain_id = candidates.token ->> 'chainId',
  asset_standard = candidates.token ->> 'standard',
  asset_address = candidates.token ->> 'address',
  asset_name = candidates.token ->> 'name',
  asset_decimals = (candidates.token ->> 'decimals')::integer,
  asset_is_verified = (candidates.token ->> 'isVerified')::boolean
from candidates
where s.id = candidates.id;

with candidates as (
  select distinct on (r.id)
    r.id,
    token
  from public.receivings r
  join public.users u on u.id::text = r.user_id
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(u.assets -> 'tokens') = 'array' then u.assets -> 'tokens'
      else '[]'::jsonb
    end
  ) token
  where r.asset_chain_id is null
    and upper(token ->> 'symbol') = upper(r.asset_symbol)
    and token ->> 'chainId' ~ '^[0-9]+$'
    and token ->> 'standard' in ('native', 'ERC-20')
    and coalesce(token ->> 'name', '') <> ''
    and token ->> 'decimals' ~ '^(?:[0-9]|[12][0-9]|3[0-6])$'
    and token ->> 'isVerified' in ('true', 'false')
    and (
      (token ->> 'standard' = 'native' and token ->> 'address' is null)
      or (
        token ->> 'standard' = 'ERC-20'
        and token ->> 'address' ~ '^0x[0-9A-Fa-f]{40}$'
      )
    )
  order by r.id, case when token ->> 'chainId' = '1' then 0 else 1 end
)
update public.receivings r
set
  asset_chain_id = candidates.token ->> 'chainId',
  asset_standard = candidates.token ->> 'standard',
  asset_address = candidates.token ->> 'address',
  asset_name = candidates.token ->> 'name',
  asset_decimals = (candidates.token ->> 'decimals')::integer,
  asset_is_verified = (candidates.token ->> 'isVerified')::boolean
from candidates
where r.id = candidates.id;

-- Conservative Ethereum fallback for the symbols supported by the old server.
update public.sendings
set
  asset_chain_id = '1',
  asset_standard = case when upper(asset_symbol) = 'ETH' then 'native' else 'ERC-20' end,
  asset_address = case upper(asset_symbol)
    when 'ETH' then null
    when 'USDC' then '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    when 'USDT' then '0xdAC17F958D2ee523a2206206994597C13D831ec7'
    when 'DAI' then '0x6B175474E89094C44Da98b954EedeAC495271d0F'
    when 'WBTC' then '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
    when 'WETH' then '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  end,
  asset_name = case upper(asset_symbol)
    when 'ETH' then 'Ether'
    when 'USDC' then 'USD Coin'
    when 'USDT' then 'Tether USD'
    when 'DAI' then 'Dai Stablecoin'
    when 'WBTC' then 'Wrapped BTC'
    when 'WETH' then 'Wrapped Ether'
  end,
  asset_decimals = case upper(asset_symbol)
    when 'USDC' then 6
    when 'USDT' then 6
    when 'WBTC' then 8
    else 18
  end,
  asset_is_verified = true
where asset_chain_id is null
  and upper(asset_symbol) in ('ETH', 'USDC', 'USDT', 'DAI', 'WBTC', 'WETH');

update public.receivings
set
  asset_chain_id = '1',
  asset_standard = case when upper(asset_symbol) = 'ETH' then 'native' else 'ERC-20' end,
  asset_address = case upper(asset_symbol)
    when 'ETH' then null
    when 'USDC' then '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    when 'USDT' then '0xdAC17F958D2ee523a2206206994597C13D831ec7'
    when 'DAI' then '0x6B175474E89094C44Da98b954EedeAC495271d0F'
    when 'WBTC' then '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
    when 'WETH' then '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  end,
  asset_name = case upper(asset_symbol)
    when 'ETH' then 'Ether'
    when 'USDC' then 'USD Coin'
    when 'USDT' then 'Tether USD'
    when 'DAI' then 'Dai Stablecoin'
    when 'WBTC' then 'Wrapped BTC'
    when 'WETH' then 'Wrapped Ether'
  end,
  asset_decimals = case upper(asset_symbol)
    when 'USDC' then 6
    when 'USDT' then 6
    when 'WBTC' then 8
    else 18
  end,
  asset_is_verified = true
where asset_chain_id is null
  and upper(asset_symbol) in ('ETH', 'USDC', 'USDT', 'DAI', 'WBTC', 'WETH');

-- Existing successful rows are treated as already applied. This records that
-- fact without recalculating or changing a user balance.
update public.sendings
set settled_at = coalesce(settled_at, created_at)
where status = 'success';

update public.receivings
set settled_at = coalesce(settled_at, created_at)
where status = 'success';

create or replace view public.settlement_backfill_unresolved as
select
  'sending'::text as transaction_kind,
  s.id::text as transaction_id,
  s.user_id,
  s.asset_symbol,
  s.status
from public.sendings s
where
  s.asset_chain_id is null
  or s.asset_standard is null
  or s.asset_name is null
  or s.asset_decimals is null
  or s.asset_is_verified is null
union all
select
  'receiving'::text as transaction_kind,
  r.id::text as transaction_id,
  r.user_id,
  r.asset_symbol,
  r.status
from public.receivings r
where
  r.asset_chain_id is null
  or r.asset_standard is null
  or r.asset_name is null
  or r.asset_decimals is null
  or r.asset_is_verified is null;

revoke all on public.settlement_backfill_unresolved from public, anon, authenticated;
grant select on public.settlement_backfill_unresolved to service_role;

create or replace function public.create_sending_transaction(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_row public.sendings%rowtype;
  v_user public.users%rowtype;
  v_status text;
  v_units numeric;
begin
  perform set_config('app.settlement_rpc', 'on', true);

  perform private.require_json_key(p_input, 'user_id');
  perform private.require_json_key(p_input, 'status');
  perform private.require_json_key(p_input, 'recipient_address');
  perform private.require_json_key(p_input, 'amount');
  perform private.require_json_key(p_input, 'asset_symbol');
  perform private.require_json_key(p_input, 'asset_chain_id');
  perform private.require_json_key(p_input, 'asset_standard');
  perform private.require_json_key(p_input, 'asset_address');
  perform private.require_json_key(p_input, 'asset_name');
  perform private.require_json_key(p_input, 'asset_decimals');
  perform private.require_json_key(p_input, 'asset_is_verified');

  v_status := p_input ->> 'status';
  perform private.assert_transfer_status(v_status);
  perform private.assert_transfer_asset(
    p_input ->> 'asset_chain_id',
    p_input ->> 'asset_standard',
    p_input ->> 'asset_address',
    p_input ->> 'asset_symbol',
    p_input ->> 'asset_name',
    (p_input ->> 'asset_decimals')::integer,
    (p_input ->> 'asset_is_verified')::boolean
  );
  v_units := private.transfer_amount_to_units(
    p_input ->> 'amount',
    (p_input ->> 'asset_decimals')::integer
  );

  select *
  into v_user
  from public.users
  where id::text = p_input ->> 'user_id'
  for update;

  if not found then
    raise exception 'User for this sending was not found.'
      using errcode = 'P0002';
  end if;

  if v_status = 'success' then
    v_user.assets := private.apply_asset_delta(
      v_user.assets,
      p_input ->> 'asset_chain_id',
      p_input ->> 'asset_standard',
      p_input ->> 'asset_address',
      p_input ->> 'asset_symbol',
      p_input ->> 'asset_name',
      (p_input ->> 'asset_decimals')::integer,
      (p_input ->> 'asset_is_verified')::boolean,
      -v_units,
      false
    );

    update public.users
    set assets = v_user.assets
    where id = v_user.id
    returning * into v_user;
  end if;

  insert into public.sendings (
    user_id,
    status,
    failure_message,
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
  )
  values (
    p_input ->> 'user_id',
    v_status,
    p_input ->> 'failure_message',
    p_input ->> 'recipient_address',
    p_input ->> 'amount',
    upper(btrim(p_input ->> 'asset_symbol')),
    p_input ->> 'asset_chain_id',
    p_input ->> 'asset_standard',
    p_input ->> 'asset_address',
    btrim(p_input ->> 'asset_name'),
    (p_input ->> 'asset_decimals')::integer,
    (p_input ->> 'asset_is_verified')::boolean,
    case when v_status = 'success' then clock_timestamp() else null end
  )
  returning * into v_row;

  return jsonb_build_object(
    'transaction', to_jsonb(v_row),
    'assets', v_user.assets,
    'assets_revision', v_user.assets_revision
  );
end;
$$;

create or replace function public.update_sending_transaction(
  p_id bigint,
  p_input jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_row public.sendings%rowtype;
  v_user public.users%rowtype;
  v_status text;
  v_units numeric;
  v_old_units numeric;
  v_assets_changed boolean := false;
begin
  perform set_config('app.settlement_rpc', 'on', true);

  perform private.require_json_key(p_input, 'status');
  perform private.require_json_key(p_input, 'recipient_address');
  perform private.require_json_key(p_input, 'amount');
  perform private.require_json_key(p_input, 'asset_symbol');
  perform private.require_json_key(p_input, 'asset_chain_id');
  perform private.require_json_key(p_input, 'asset_standard');
  perform private.require_json_key(p_input, 'asset_address');
  perform private.require_json_key(p_input, 'asset_name');
  perform private.require_json_key(p_input, 'asset_decimals');
  perform private.require_json_key(p_input, 'asset_is_verified');

  select *
  into v_row
  from public.sendings
  where id = p_id
  for update;

  if not found then
    raise exception 'Sending was not found.'
      using errcode = 'P0002';
  end if;

  v_status := p_input ->> 'status';
  perform private.assert_transfer_status(v_status);
  perform private.assert_transfer_asset(
    p_input ->> 'asset_chain_id',
    p_input ->> 'asset_standard',
    p_input ->> 'asset_address',
    p_input ->> 'asset_symbol',
    p_input ->> 'asset_name',
    (p_input ->> 'asset_decimals')::integer,
    (p_input ->> 'asset_is_verified')::boolean
  );
  v_units := private.transfer_amount_to_units(
    p_input ->> 'amount',
    (p_input ->> 'asset_decimals')::integer
  );

  select *
  into v_user
  from public.users
  where id::text = v_row.user_id
  for update;

  if not found then
    raise exception 'User for this sending was not found.'
      using errcode = 'P0002';
  end if;

  if
    v_row.status is not distinct from v_status
    and v_row.failure_message is not distinct from (p_input ->> 'failure_message')
    and v_row.recipient_address is not distinct from (p_input ->> 'recipient_address')
    and v_row.amount is not distinct from (p_input ->> 'amount')
    and v_row.asset_symbol is not distinct from upper(btrim(p_input ->> 'asset_symbol'))
    and v_row.asset_chain_id is not distinct from (p_input ->> 'asset_chain_id')
    and v_row.asset_standard is not distinct from (p_input ->> 'asset_standard')
    and lower(coalesce(v_row.asset_address, '')) = lower(coalesce(p_input ->> 'asset_address', ''))
    and v_row.asset_name is not distinct from btrim(p_input ->> 'asset_name')
    and v_row.asset_decimals is not distinct from (p_input ->> 'asset_decimals')::integer
    and v_row.asset_is_verified is not distinct from (p_input ->> 'asset_is_verified')::boolean
  then
    return jsonb_build_object(
      'transaction', to_jsonb(v_row),
      'assets', v_user.assets,
      'assets_revision', v_user.assets_revision
    );
  end if;

  if v_row.status = 'success' then
    perform private.assert_transfer_asset(
      v_row.asset_chain_id,
      v_row.asset_standard,
      v_row.asset_address,
      v_row.asset_symbol,
      v_row.asset_name,
      v_row.asset_decimals,
      v_row.asset_is_verified
    );
    v_old_units := private.transfer_amount_to_units(v_row.amount, v_row.asset_decimals);
    v_user.assets := private.apply_asset_delta(
      v_user.assets,
      v_row.asset_chain_id,
      v_row.asset_standard,
      v_row.asset_address,
      v_row.asset_symbol,
      v_row.asset_name,
      v_row.asset_decimals,
      v_row.asset_is_verified,
      v_old_units,
      true
    );
    v_assets_changed := true;
  end if;

  if v_status = 'success' then
    v_user.assets := private.apply_asset_delta(
      v_user.assets,
      p_input ->> 'asset_chain_id',
      p_input ->> 'asset_standard',
      p_input ->> 'asset_address',
      p_input ->> 'asset_symbol',
      p_input ->> 'asset_name',
      (p_input ->> 'asset_decimals')::integer,
      (p_input ->> 'asset_is_verified')::boolean,
      -v_units,
      false
    );
    v_assets_changed := true;
  end if;

  if v_assets_changed then
    update public.users
    set assets = v_user.assets
    where id = v_user.id
    returning * into v_user;
  end if;

  update public.sendings
  set
    status = v_status,
    failure_message = p_input ->> 'failure_message',
    recipient_address = p_input ->> 'recipient_address',
    amount = p_input ->> 'amount',
    asset_symbol = upper(btrim(p_input ->> 'asset_symbol')),
    asset_chain_id = p_input ->> 'asset_chain_id',
    asset_standard = p_input ->> 'asset_standard',
    asset_address = p_input ->> 'asset_address',
    asset_name = btrim(p_input ->> 'asset_name'),
    asset_decimals = (p_input ->> 'asset_decimals')::integer,
    asset_is_verified = (p_input ->> 'asset_is_verified')::boolean,
    settled_at = case when v_status = 'success' then clock_timestamp() else null end
  where id = p_id
  returning * into v_row;

  return jsonb_build_object(
    'transaction', to_jsonb(v_row),
    'assets', v_user.assets,
    'assets_revision', v_user.assets_revision
  );
end;
$$;

create or replace function public.create_receiving_transaction(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_row public.receivings%rowtype;
  v_user public.users%rowtype;
  v_status text;
  v_units numeric;
begin
  perform set_config('app.settlement_rpc', 'on', true);

  perform private.require_json_key(p_input, 'user_id');
  perform private.require_json_key(p_input, 'status');
  perform private.require_json_key(p_input, 'amount');
  perform private.require_json_key(p_input, 'asset_symbol');
  perform private.require_json_key(p_input, 'asset_chain_id');
  perform private.require_json_key(p_input, 'asset_standard');
  perform private.require_json_key(p_input, 'asset_address');
  perform private.require_json_key(p_input, 'asset_name');
  perform private.require_json_key(p_input, 'asset_decimals');
  perform private.require_json_key(p_input, 'asset_is_verified');

  v_status := p_input ->> 'status';
  perform private.assert_transfer_status(v_status);
  perform private.assert_transfer_asset(
    p_input ->> 'asset_chain_id',
    p_input ->> 'asset_standard',
    p_input ->> 'asset_address',
    p_input ->> 'asset_symbol',
    p_input ->> 'asset_name',
    (p_input ->> 'asset_decimals')::integer,
    (p_input ->> 'asset_is_verified')::boolean
  );
  v_units := private.transfer_amount_to_units(
    p_input ->> 'amount',
    (p_input ->> 'asset_decimals')::integer
  );

  select *
  into v_user
  from public.users
  where id::text = p_input ->> 'user_id'
  for update;

  if not found then
    raise exception 'User for this receiving was not found.'
      using errcode = 'P0002';
  end if;

  if v_status = 'success' then
    v_user.assets := private.apply_asset_delta(
      v_user.assets,
      p_input ->> 'asset_chain_id',
      p_input ->> 'asset_standard',
      p_input ->> 'asset_address',
      p_input ->> 'asset_symbol',
      p_input ->> 'asset_name',
      (p_input ->> 'asset_decimals')::integer,
      (p_input ->> 'asset_is_verified')::boolean,
      v_units,
      true
    );

    update public.users
    set assets = v_user.assets
    where id = v_user.id
    returning * into v_user;
  end if;

  insert into public.receivings (
    user_id,
    status,
    failure_message,
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
  )
  values (
    p_input ->> 'user_id',
    v_status,
    p_input ->> 'failure_message',
    p_input ->> 'recipient_address',
    p_input ->> 'amount',
    upper(btrim(p_input ->> 'asset_symbol')),
    p_input ->> 'usd_amount',
    p_input ->> 'asset_chain_id',
    p_input ->> 'asset_standard',
    p_input ->> 'asset_address',
    btrim(p_input ->> 'asset_name'),
    (p_input ->> 'asset_decimals')::integer,
    (p_input ->> 'asset_is_verified')::boolean,
    case when v_status = 'success' then clock_timestamp() else null end
  )
  returning * into v_row;

  return jsonb_build_object(
    'transaction', to_jsonb(v_row),
    'assets', v_user.assets,
    'assets_revision', v_user.assets_revision
  );
end;
$$;

create or replace function public.update_receiving_transaction(
  p_id uuid,
  p_input jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_row public.receivings%rowtype;
  v_user public.users%rowtype;
  v_status text;
  v_units numeric;
  v_old_units numeric;
  v_assets_changed boolean := false;
begin
  perform set_config('app.settlement_rpc', 'on', true);

  perform private.require_json_key(p_input, 'status');
  perform private.require_json_key(p_input, 'amount');
  perform private.require_json_key(p_input, 'asset_symbol');
  perform private.require_json_key(p_input, 'asset_chain_id');
  perform private.require_json_key(p_input, 'asset_standard');
  perform private.require_json_key(p_input, 'asset_address');
  perform private.require_json_key(p_input, 'asset_name');
  perform private.require_json_key(p_input, 'asset_decimals');
  perform private.require_json_key(p_input, 'asset_is_verified');

  select *
  into v_row
  from public.receivings
  where id = p_id
  for update;

  if not found then
    raise exception 'Receiving was not found.'
      using errcode = 'P0002';
  end if;

  v_status := p_input ->> 'status';
  perform private.assert_transfer_status(v_status);
  perform private.assert_transfer_asset(
    p_input ->> 'asset_chain_id',
    p_input ->> 'asset_standard',
    p_input ->> 'asset_address',
    p_input ->> 'asset_symbol',
    p_input ->> 'asset_name',
    (p_input ->> 'asset_decimals')::integer,
    (p_input ->> 'asset_is_verified')::boolean
  );
  v_units := private.transfer_amount_to_units(
    p_input ->> 'amount',
    (p_input ->> 'asset_decimals')::integer
  );

  select *
  into v_user
  from public.users
  where id::text = v_row.user_id
  for update;

  if not found then
    raise exception 'User for this receiving was not found.'
      using errcode = 'P0002';
  end if;

  if
    v_row.status is not distinct from v_status
    and v_row.failure_message is not distinct from (p_input ->> 'failure_message')
    and v_row.recipient_address is not distinct from (p_input ->> 'recipient_address')
    and v_row.amount is not distinct from (p_input ->> 'amount')
    and v_row.asset_symbol is not distinct from upper(btrim(p_input ->> 'asset_symbol'))
    and v_row.usd_amount is not distinct from (p_input ->> 'usd_amount')
    and v_row.asset_chain_id is not distinct from (p_input ->> 'asset_chain_id')
    and v_row.asset_standard is not distinct from (p_input ->> 'asset_standard')
    and lower(coalesce(v_row.asset_address, '')) = lower(coalesce(p_input ->> 'asset_address', ''))
    and v_row.asset_name is not distinct from btrim(p_input ->> 'asset_name')
    and v_row.asset_decimals is not distinct from (p_input ->> 'asset_decimals')::integer
    and v_row.asset_is_verified is not distinct from (p_input ->> 'asset_is_verified')::boolean
  then
    return jsonb_build_object(
      'transaction', to_jsonb(v_row),
      'assets', v_user.assets,
      'assets_revision', v_user.assets_revision
    );
  end if;

  if v_row.status = 'success' then
    perform private.assert_transfer_asset(
      v_row.asset_chain_id,
      v_row.asset_standard,
      v_row.asset_address,
      v_row.asset_symbol,
      v_row.asset_name,
      v_row.asset_decimals,
      v_row.asset_is_verified
    );
    v_old_units := private.transfer_amount_to_units(v_row.amount, v_row.asset_decimals);
    v_user.assets := private.apply_asset_delta(
      v_user.assets,
      v_row.asset_chain_id,
      v_row.asset_standard,
      v_row.asset_address,
      v_row.asset_symbol,
      v_row.asset_name,
      v_row.asset_decimals,
      v_row.asset_is_verified,
      -v_old_units,
      false
    );
    v_assets_changed := true;
  end if;

  if v_status = 'success' then
    v_user.assets := private.apply_asset_delta(
      v_user.assets,
      p_input ->> 'asset_chain_id',
      p_input ->> 'asset_standard',
      p_input ->> 'asset_address',
      p_input ->> 'asset_symbol',
      p_input ->> 'asset_name',
      (p_input ->> 'asset_decimals')::integer,
      (p_input ->> 'asset_is_verified')::boolean,
      v_units,
      true
    );
    v_assets_changed := true;
  end if;

  if v_assets_changed then
    update public.users
    set assets = v_user.assets
    where id = v_user.id
    returning * into v_user;
  end if;

  update public.receivings
  set
    status = v_status,
    failure_message = p_input ->> 'failure_message',
    recipient_address = p_input ->> 'recipient_address',
    amount = p_input ->> 'amount',
    asset_symbol = upper(btrim(p_input ->> 'asset_symbol')),
    usd_amount = p_input ->> 'usd_amount',
    asset_chain_id = p_input ->> 'asset_chain_id',
    asset_standard = p_input ->> 'asset_standard',
    asset_address = p_input ->> 'asset_address',
    asset_name = btrim(p_input ->> 'asset_name'),
    asset_decimals = (p_input ->> 'asset_decimals')::integer,
    asset_is_verified = (p_input ->> 'asset_is_verified')::boolean,
    settled_at = case when v_status = 'success' then clock_timestamp() else null end
  where id = p_id
  returning * into v_row;

  return jsonb_build_object(
    'transaction', to_jsonb(v_row),
    'assets', v_user.assets,
    'assets_revision', v_user.assets_revision
  );
end;
$$;

revoke all on function public.create_sending_transaction(jsonb) from public, anon, authenticated;
revoke all on function public.update_sending_transaction(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.create_receiving_transaction(jsonb) from public, anon, authenticated;
revoke all on function public.update_receiving_transaction(uuid, jsonb) from public, anon, authenticated;

grant execute on function public.create_sending_transaction(jsonb) to service_role;
grant execute on function public.update_sending_transaction(bigint, jsonb) to service_role;
grant execute on function public.create_receiving_transaction(jsonb) to service_role;
grant execute on function public.update_receiving_transaction(uuid, jsonb) to service_role;

-- Legacy table grants intentionally remain unchanged during expansion.
