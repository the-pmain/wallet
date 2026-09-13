-- The dashboard schema still has sendings.id → users(id). Identity then
-- emits 1, 2, 3… and collides with existing sendings (23505) or unused
-- users (23503). Reuse a free users.id as the sending primary key;
-- user_id still names the owner.

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
  v_id bigint;
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

  select u.id
  into v_id
  from public.users u
  where not exists (select 1 from public.sendings s where s.id = u.id)
  order by u.id
  limit 1
  for update skip locked;

  if v_id is null then
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
  else
    insert into public.sendings (
      id,
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
      v_id,
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
  end if;

  return jsonb_build_object(
    'transaction', to_jsonb(v_row),
    'assets', v_user.assets,
    'assets_revision', v_user.assets_revision
  );
end;
$$;
