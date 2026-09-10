-- Local/staging verification for the expand migration.
-- Every test runs in one transaction and is rolled back.

begin;

do $$
declare
  v_user_id text;
  v_legacy_sending_id bigint;
  v_legacy_receiving_id uuid;
  v_result jsonb;
  v_sending_id bigint;
  v_receiving_id uuid;
  v_balance text;
  v_revision bigint;
  v_revision_after_retry bigint;
  v_failed_as_expected boolean := false;
begin
  insert into public.users (
    email,
    balance,
    the_p,
    wallets,
    assets,
    seed_phrase
  )
  values (
    'atomic-settlement-local@example.invalid',
    '0',
    'local-only',
    '{}'::jsonb,
    jsonb_build_object(
      'quoteCurrency', 'USD',
      'updatedAt', '2026-09-10T00:00:00.000Z',
      'tokens', jsonb_build_array(
        jsonb_build_object(
          'chainId', '1',
          'standard', 'native',
          'address', null,
          'symbol', 'ETH',
          'name', 'Ether',
          'decimals', 18,
          'balance', '10000000000000000000',
          'isVerified', true
        )
      )
    ),
    null
  )
  returning id::text into v_user_id;

  -- The currently deployed server can still omit every expansion column.
  set local role service_role;

  insert into public.sendings (
    user_id,
    status,
    failure_message,
    recipient_address,
    amount,
    asset_symbol
  )
  values (
    v_user_id,
    'pending',
    null,
    '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
    '1',
    'ETH'
  )
  returning id into v_legacy_sending_id;

  update public.sendings
  set status = 'failure', failure_message = 'Legacy PATCH remains accepted'
  where id = v_legacy_sending_id;

  insert into public.receivings (
    user_id,
    status,
    failure_message,
    recipient_address,
    amount,
    asset_symbol,
    usd_amount
  )
  values (
    v_user_id,
    'pending',
    null,
    null,
    '1',
    'ETH',
    '1'
  )
  returning id into v_legacy_receiving_id;

  update public.receivings
  set status = 'failure', failure_message = 'Legacy PATCH remains accepted'
  where id = v_legacy_receiving_id;

  reset role;

  -- A successful receiving appends an absent exact asset.
  v_result := public.create_receiving_transaction(
    jsonb_build_object(
      'user_id', v_user_id,
      'status', 'success',
      'failure_message', null,
      'recipient_address', null,
      'amount', '2.5',
      'asset_symbol', 'USDC',
      'usd_amount', '2.5',
      'asset_chain_id', '1',
      'asset_standard', 'ERC-20',
      'asset_address', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      'asset_name', 'USD Coin',
      'asset_decimals', 6,
      'asset_is_verified', true
    )
  );
  v_receiving_id := (v_result #>> '{transaction,id}')::uuid;

  select token ->> 'balance'
  into v_balance
  from public.users u
  cross join lateral jsonb_array_elements(u.assets -> 'tokens') token
  where u.id::text = v_user_id
    and token ->> 'chainId' = '1'
    and lower(token ->> 'address') =
      lower('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');

  if v_balance is distinct from '2500000' then
    raise exception 'Receiving credit failed: expected 2500000, got %', v_balance;
  end if;

  -- Reversal removes only this receiving's contribution and keeps the entity.
  perform public.update_receiving_transaction(
    v_receiving_id,
    jsonb_build_object(
      'status', 'failure',
      'failure_message', 'Reversed locally',
      'recipient_address', null,
      'amount', '2.5',
      'asset_symbol', 'USDC',
      'usd_amount', '2.5',
      'asset_chain_id', '1',
      'asset_standard', 'ERC-20',
      'asset_address', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      'asset_name', 'USD Coin',
      'asset_decimals', 6,
      'asset_is_verified', true
    )
  );

  select token ->> 'balance'
  into v_balance
  from public.users u
  cross join lateral jsonb_array_elements(u.assets -> 'tokens') token
  where u.id::text = v_user_id
    and lower(token ->> 'address') =
      lower('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');

  if v_balance is distinct from '0' then
    raise exception 'Receiving reversal failed: expected retained zero, got %', v_balance;
  end if;

  -- Sending success debits; success-to-success edit restores old then applies new.
  v_result := public.create_sending_transaction(
    jsonb_build_object(
      'user_id', v_user_id,
      'status', 'success',
      'failure_message', null,
      'recipient_address', '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
      'amount', '1',
      'asset_symbol', 'ETH',
      'asset_chain_id', '1',
      'asset_standard', 'native',
      'asset_address', null,
      'asset_name', 'Ether',
      'asset_decimals', 18,
      'asset_is_verified', true
    )
  );
  v_sending_id := (v_result #>> '{transaction,id}')::bigint;

  perform public.update_sending_transaction(
    v_sending_id,
    jsonb_build_object(
      'status', 'success',
      'failure_message', null,
      'recipient_address', '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
      'amount', '2',
      'asset_symbol', 'ETH',
      'asset_chain_id', '1',
      'asset_standard', 'native',
      'asset_address', null,
      'asset_name', 'Ether',
      'asset_decimals', 18,
      'asset_is_verified', true
    )
  );

  select token ->> 'balance', u.assets_revision
  into v_balance, v_revision
  from public.users u
  cross join lateral jsonb_array_elements(u.assets -> 'tokens') token
  where u.id::text = v_user_id
    and token ->> 'chainId' = '1'
    and token ->> 'standard' = 'native';

  if v_balance is distinct from '8000000000000000000' then
    raise exception 'Sending edit reconciliation failed: expected 8 ETH, got %', v_balance;
  end if;

  -- An identical retry is a true no-op, including the asset revision.
  perform public.update_sending_transaction(
    v_sending_id,
    jsonb_build_object(
      'status', 'success',
      'failure_message', null,
      'recipient_address', '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
      'amount', '2',
      'asset_symbol', 'ETH',
      'asset_chain_id', '1',
      'asset_standard', 'native',
      'asset_address', null,
      'asset_name', 'Ether',
      'asset_decimals', 18,
      'asset_is_verified', true
    )
  );

  select assets_revision
  into v_revision_after_retry
  from public.users
  where id::text = v_user_id;

  if v_revision_after_retry <> v_revision then
    raise exception 'Identical retry unexpectedly changed assets_revision.';
  end if;

  -- Reversal restores the exact old debit.
  perform public.update_sending_transaction(
    v_sending_id,
    jsonb_build_object(
      'status', 'failure',
      'failure_message', 'Reversed locally',
      'recipient_address', '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
      'amount', '2',
      'asset_symbol', 'ETH',
      'asset_chain_id', '1',
      'asset_standard', 'native',
      'asset_address', null,
      'asset_name', 'Ether',
      'asset_decimals', 18,
      'asset_is_verified', true
    )
  );

  select token ->> 'balance'
  into v_balance
  from public.users u
  cross join lateral jsonb_array_elements(u.assets -> 'tokens') token
  where u.id::text = v_user_id
    and token ->> 'chainId' = '1'
    and token ->> 'standard' = 'native';

  if v_balance is distinct from '10000000000000000000' then
    raise exception 'Sending reversal failed: expected 10 ETH, got %', v_balance;
  end if;

  -- Insufficient funds aborts both the new debit and transaction creation.
  begin
    perform public.create_sending_transaction(
      jsonb_build_object(
        'user_id', v_user_id,
        'status', 'success',
        'failure_message', null,
        'recipient_address', '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
        'amount', '11',
        'asset_symbol', 'ETH',
        'asset_chain_id', '1',
        'asset_standard', 'native',
        'asset_address', null,
        'asset_name', 'Ether',
        'asset_decimals', 18,
        'asset_is_verified', true
      )
    );
  exception
    when check_violation then
      v_failed_as_expected := true;
  end;

  if not v_failed_as_expected then
    raise exception 'Insufficient sending balance was not rejected.';
  end if;

  select token ->> 'balance'
  into v_balance
  from public.users u
  cross join lateral jsonb_array_elements(u.assets -> 'tokens') token
  where u.id::text = v_user_id
    and token ->> 'chainId' = '1'
    and token ->> 'standard' = 'native';

  if v_balance is distinct from '10000000000000000000' then
    raise exception 'Insufficient-funds rollback changed the ETH balance.';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.create_sending_transaction(jsonb)',
    'EXECUTE'
  ) then
    raise exception 'service_role cannot execute create_sending_transaction.';
  end if;

  if has_function_privilege(
    'anon',
    'public.create_sending_transaction(jsonb)',
    'EXECUTE'
  ) then
    raise exception 'anon unexpectedly has settlement RPC execution.';
  end if;
end;
$$;

rollback;
