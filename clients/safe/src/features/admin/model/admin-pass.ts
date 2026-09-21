/**
 * Admin cabinet password in `localStorage`.
 *
 * After the server accepts it, the presented value is stored here.
 * The next visit to `/admin` does not ask again: the server still
 * checks the header on every request.
 */

export const ADMIN_PASS_STORAGE_KEY = 'elmsafe.admin-pass'
const LEGACY_ADMIN_PIN_STORAGE_KEY = 'elmsafe.admin-pin'

/** Reads the stored password. A corrupted record is treated as missing. */
export function readAdminPass(): string | null {
  try {
    localStorage.removeItem(LEGACY_ADMIN_PIN_STORAGE_KEY)
    const raw = localStorage.getItem(ADMIN_PASS_STORAGE_KEY)

    if (raw === null) {
      return null
    }

    const trimmed = raw.trim()

    return trimmed === '' ? null : trimmed
  } catch {
    return null
  }
}

export function writeAdminPass(pass: string): void {
  try {
    localStorage.removeItem(LEGACY_ADMIN_PIN_STORAGE_KEY)
    localStorage.setItem(ADMIN_PASS_STORAGE_KEY, pass)
  } catch {
    /* No quota — this tab's session is still open. */
  }
}

export function clearAdminPass(): void {
  try {
    localStorage.removeItem(ADMIN_PASS_STORAGE_KEY)
    localStorage.removeItem(LEGACY_ADMIN_PIN_STORAGE_KEY)
  } catch {
    /* No storage — nothing to clear. */
  }
}
