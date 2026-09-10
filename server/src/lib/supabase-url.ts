/**
 * Loopback check for the local Supabase API URL.
 *
 * In development the Node process must not talk to a hosted project,
 * even if `.env` still has a production `SUPABASE_URL`.
 */

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

export function isLocalSupabaseUrl(raw: string): boolean {
  let parsed: URL

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
