-- public.activity_requests — admin drafts awaiting super-admin approval.
-- Hosted table already exists; this file is for local `supabase db reset`.

create table public.activity_requests (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  kind text not null,
  request_status text not null default 'pending'::text,
  requested_by_name text not null,
  reviewed_at timestamp with time zone null,
  reviewed_by_name text null,
  review_message text null,
  created_sending_id text null,
  created_receiving_id text null,
  user_id text not null,
  transfer_status text not null default 'pending'::text,
  failure_message text null,
  recipient_address text null,
  amount text not null,
  asset_symbol text not null,
  usd_amount text null,
  asset_chain_id text null,
  asset_standard text null,
  asset_address text null,
  asset_name text null,
  asset_decimals integer null,
  asset_is_verified boolean null,
  constraint activity_requests_pkey primary key (id),
  constraint activity_requests_kind_check check (
    kind = any (array['sending'::text, 'receiving'::text])
  ),
  constraint activity_requests_kind_created_id_check check (
    (
      (kind = 'sending'::text and created_receiving_id is null)
      or (kind = 'receiving'::text and created_sending_id is null)
    )
  ),
  constraint activity_requests_request_status_check check (
    request_status = any (
      array['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text]
    )
  ),
  constraint activity_requests_requested_by_name_check check (
    char_length(btrim(requested_by_name)) >= 1
    and char_length(btrim(requested_by_name)) <= 64
  ),
  constraint activity_requests_reviewed_by_name_check check (
    reviewed_by_name is null
    or (
      char_length(btrim(reviewed_by_name)) >= 1
      and char_length(btrim(reviewed_by_name)) <= 64
    )
  ),
  constraint activity_requests_sending_usd_amount_check check (
    kind = 'receiving'::text or usd_amount is null
  ),
  constraint activity_requests_transfer_status_check check (
    transfer_status = any (array['pending'::text, 'success'::text, 'failure'::text])
  )
);

create index activity_requests_created_at_idx
  on public.activity_requests using btree (created_at desc);

create index activity_requests_request_status_idx
  on public.activity_requests using btree (request_status);

create index activity_requests_kind_idx
  on public.activity_requests using btree (kind);

create index activity_requests_user_id_idx
  on public.activity_requests using btree (user_id);

create index activity_requests_requested_by_name_idx
  on public.activity_requests using btree (requested_by_name);

create index activity_requests_pending_created_at_idx
  on public.activity_requests using btree (created_at desc)
  where request_status = 'pending'::text;

comment on table public.activity_requests is
  'Cabinet drafts for a sending or receiving. Super admin approves; Node then writes sendings/receivings.';

comment on column public.activity_requests.request_status is
  'Approval state: pending, approved, rejected, cancelled. Not the transfer status.';

comment on column public.activity_requests.transfer_status is
  'Status the created sending/receiving should have after approval.';

comment on column public.activity_requests.requested_by_name is
  'Cabinet operator display name (1–64 characters).';

alter table public.activity_requests enable row level security;

revoke all on table public.activity_requests from anon, authenticated;

grant select, insert, update, delete on public.activity_requests to service_role;
