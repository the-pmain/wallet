import { timingSafeEqual } from 'node:crypto'

export const ADMIN_ROLE = {
  Admin: 'admin',
  Super: 'super',
} as const

export type AdminRole = (typeof ADMIN_ROLE)[keyof typeof ADMIN_ROLE]

/**
 * Cabinet password (`/admin`).
 *
 * `ADMIN_PASS` — read. `SUPER_ADMIN_PASS` — full write.
 * No values in source: check against the environment only.
 */
export function resolveAdminRole(value: string): AdminRole | null {
  const presented = value.trim()

  if (presented === '') {
    return null
  }

  const superPass = readEnvPass('SUPER_ADMIN_PASS')
  const adminPass = readEnvPass('ADMIN_PASS')
  const isSuper = superPass !== null && constantTimeEquals(superPass, presented)
  const isAdmin = adminPass !== null && constantTimeEquals(adminPass, presented)

  if (isSuper) {
    return ADMIN_ROLE.Super
  }

  if (isAdmin) {
    return ADMIN_ROLE.Admin
  }

  return null
}

/** Any accepted cabinet role. */
export function passMatches(value: string): boolean {
  return resolveAdminRole(value) !== null
}

function readEnvPass(name: string): string | null {
  const raw = process.env[name]

  if (raw === undefined || raw.trim() === '') {
    return null
  }

  return raw.trim()
}

function constantTimeEquals(expectedUtf8: string, value: string): boolean {
  const expected = Buffer.from(expectedUtf8, 'utf8')
  const given = Buffer.from(value, 'utf8')

  if (expected.length !== given.length) {
    timingSafeEqual(expected, expected)

    return false
  }

  return timingSafeEqual(expected, given)
}
