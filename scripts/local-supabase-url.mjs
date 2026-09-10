/**
 * Loopback check for local Supabase API URLs.
 *
 * Scripts that talk to PostgREST must refuse anything else so a
 * production project URL in `.env` cannot be used by accident.
 */

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

export function isLocalSupabaseUrl(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return false
  }

  let parsed

  try {
    parsed = new URL(raw)
  } catch {
    return false
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false
  }

  return LOCAL_HOSTS.has(parsed.hostname.toLowerCase())
}

export function assertLocalSupabaseUrl(raw, context) {
  if (isLocalSupabaseUrl(raw)) {
    return
  }

  console.error(
    `${context} refused a non-local Supabase URL. ` +
      'This command only talks to 127.0.0.1 or localhost. ' +
      'Start the local stack with `npm run supabase:start`, then ' +
      '`npm run supabase:env` so `.env.local` overrides production keys in `.env`.',
  )
  process.exit(1)
}
