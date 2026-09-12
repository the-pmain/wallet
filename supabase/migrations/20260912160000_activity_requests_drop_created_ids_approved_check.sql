-- Pending revisions of an approved transfer keep created_sending_id /
-- created_receiving_id while request_status goes back to pending.
-- The old check only allowed those ids on approved rows.

alter table public.activity_requests
  drop constraint if exists activity_requests_created_ids_approved_check;
