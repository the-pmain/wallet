# Local Supabase

This directory is the **local Docker stack** for the Node `/v1` process.
It is not linked to a hosted project.

Do not run:

- `supabase link`
- `supabase db push`
- `supabase db reset --linked`
- `supabase db reset --db-url …`
- any command against a Dashboard project unless James has approved that
  exact command

## Start

```bash
npm run local
```

That starts the local Docker database, writes `.env.local`, then
starts the Node API and the wallet UI.

Pieces:

| Command | Purpose |
| --- | --- |
| `npm run local` | Local DB + API + wallet |
| `npm run local:db` | Local DB and `.env.local` only |
| `npm run local:stop` | Stop the local Docker stack |
| `npm run supabase:reset` | Reset the **local** database (`--local` only) |

- Wallet UI: one origin per theme (`http://localhost:3000`, `http://localhost:3001`, …)
- Node API: `http://127.0.0.1:8080`
- Local Supabase API: `http://127.0.0.1:55321`
- Studio: `http://127.0.0.1:55323`

The default CLI ports 54321–54329 are in a Windows Hyper-V excluded
range on this machine, so `supabase/config.toml` uses 55321–55329.

`.env.local` (gitignored) overrides `SUPABASE_*` from `.env`. In
`NODE_ENV=development` the Node process refuses a non-loopback
`SUPABASE_URL`, so a hosted project URL in `.env` cannot be used by
accident.

The wallet bundle never sees Supabase keys. Browser code talks to
`/v1` on the local Node process only.

## Future migrations

1. Create a Git feature branch.
2. `npm run supabase:start`
3. `npx supabase migration new <description>`
4. Add SQL to the new file under `supabase/migrations/`.
5. `npm run supabase:reset` (this is `supabase db reset --local`).
  6. Exercise the Node process against `http://127.0.0.1:55321`.
7. Commit the migration with the application change.
8. Review the migration before it is applied anywhere remote.
9. Staging, then production, only through a separately approved release.
   There is no npm script that deploys schema to a hosted project.

`server/supabase/*.sql` are SQL Editor scripts for an already-created
hosted schema (`public.users` had no CREATE TABLE there). Local resets
use `supabase/migrations/` only.
