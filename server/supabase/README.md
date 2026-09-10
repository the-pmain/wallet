# SQL Editor scripts

These files were written to paste into a hosted project's SQL Editor.
They assume `public.users` already exists. They are **not** the local
CLI migration path.

Local development uses `supabase/migrations/` at the repository root
and `npm run supabase:reset` (`supabase db reset --local`).

Do not run these files against a hosted project from the CLI. Do not
`supabase db push` them.
