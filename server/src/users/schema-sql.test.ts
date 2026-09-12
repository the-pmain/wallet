import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '../../..')
const MIGRATIONS = join(ROOT, 'supabase/migrations')
const SQL_EDITOR = join(ROOT, 'server/supabase')

function readSqlDirectory(directory: string, suffix = '.sql'): string {
  return readdirSync(directory)
    .filter((name) => name.endsWith(suffix))
    .sort()
    .map((name) => readFileSync(join(directory, name), 'utf8'))
    .join('\n')
}

function statementsOnly(sql: string): string {
  return sql.replace(/--[^\n]*/gu, '')
}

describe('local schema', () => {
  it('creates the tables the Node process uses and locks them down', () => {
    const sql = readSqlDirectory(MIGRATIONS)

    expect(sql).toMatch(/create table public\.users/u)
    expect(sql).toMatch(/create table public\.sendings/u)
    expect(sql).toMatch(/create table public\.receivings/u)
    expect(sql).toMatch(/create table public\.login_events/u)
    expect(sql).toMatch(/create table public\.activity_requests/u)
    expect(sql).toMatch(/email text/u)
    expect(sql).toMatch(/the_p text/u)
    expect(sql).toMatch(/wallets jsonb/u)
    expect(sql).toMatch(/assets jsonb/u)
    expect(sql).toMatch(/seed_phrase text/u)

    for (const table of ['users', 'sendings', 'receivings', 'login_events', 'activity_requests']) {
      expect(sql).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security`, 'u'),
      )
      expect(sql).toMatch(
        new RegExp(`revoke all on table public\\.${table} from anon, authenticated`, 'u'),
      )
      expect(sql).toMatch(
        new RegExp(
          `grant select, insert, update, delete on(?: table)? public\\.${table} to service_role`,
          'u',
        ),
      )
    }
  })

  it('does not open tables with USING (true) or ship destructive data wipes', () => {
    const sql = statementsOnly(readSqlDirectory(MIGRATIONS))

    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/iu)
    expect(sql).not.toMatch(/with check\s*\(\s*true\s*\)/iu)
    expect(sql).not.toMatch(/create policy/iu)
    expect(sql).not.toMatch(/drop table public\.users/iu)
    expect(sql).not.toMatch(/drop table public\.sendings/iu)
    expect(sql).not.toMatch(/\btruncate\b/iu)
    expect(sql).not.toMatch(/\bdelete from\b/iu)
  })

  it('keeps the SQL Editor scripts from opening RLS', () => {
    const sql = statementsOnly(readSqlDirectory(SQL_EDITOR))

    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/iu)
    expect(sql).not.toMatch(/with check\s*\(\s*true\s*\)/iu)
    expect(sql).not.toMatch(/create policy/iu)
  })

  it('does not add scripts that push or link a hosted project', () => {
    const packageJson = readFileSync(join(ROOT, 'package.json'), 'utf8')
    const config = readFileSync(join(ROOT, 'supabase/config.toml'), 'utf8')

    expect(packageJson).not.toMatch(/db push/u)
    expect(packageJson).not.toMatch(/supabase link/u)
    expect(packageJson).toMatch(/"local": "node scripts\/dev-local.mjs"/u)
    expect(packageJson).toMatch(/"local:db": "node scripts\/dev-local.mjs --db-only"/u)
    expect(packageJson).toMatch(/"supabase:reset": "supabase db reset --local"/u)

    const launcher = readFileSync(join(ROOT, 'scripts/dev-local.mjs'), 'utf8')
    expect(launcher).not.toMatch(/db push/u)
    expect(launcher).not.toMatch(/supabase link/u)
    expect(launcher).not.toMatch(/--linked/u)
    expect(launcher).toMatch(/npm run local/u)
    expect(config).toMatch(/Do not `supabase link`/u)
    expect(config).toMatch(/Do not `supabase db push`/u)
  })

  it('keeps seed.sql free of customer data', () => {
    const seed = readFileSync(join(ROOT, 'supabase/seed.sql'), 'utf8')

    expect(seed).toMatch(/Intentionally empty of rows/u)
    expect(seed).not.toMatch(/insert into/iu)
    expect(seed).not.toMatch(/@/u)
  })
})
