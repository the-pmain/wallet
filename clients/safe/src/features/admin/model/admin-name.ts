/**
 * Cabinet operator name in `localStorage`.
 *
 * Required only for the admin role: after a successful sign-in the
 * presented name is stored here, and the form fills it on the next
 * visit. Signing in under a different name overwrites the record.
 * Super admin does not ask for a name and does not touch this record.
 */

export const ADMIN_NAME_STORAGE_KEY = 'elmsafe.admin-name'

export const ADMIN_NAME_MAX_LENGTH = 64

/** Reads the stored name. A corrupted record is treated as missing. */
export function readAdminName(): string | null {
  try {
    const raw = localStorage.getItem(ADMIN_NAME_STORAGE_KEY)

    if (raw === null) {
      return null
    }

    const trimmed = raw.trim()

    return trimmed === '' ? null : trimmed.slice(0, ADMIN_NAME_MAX_LENGTH)
  } catch {
    return null
  }
}

/** Writes the name after a successful admin sign-in. Empty values are ignored. */
export function writeAdminName(name: string): void {
  const trimmed = name.trim().slice(0, ADMIN_NAME_MAX_LENGTH)

  if (trimmed === '') {
    return
  }

  try {
    localStorage.setItem(ADMIN_NAME_STORAGE_KEY, trimmed)
  } catch {
    /* No quota — this tab's session is still open. */
  }
}

export function clearAdminName(): void {
  try {
    localStorage.removeItem(ADMIN_NAME_STORAGE_KEY)
  } catch {
    /* No storage — nothing to clear. */
  }
}
