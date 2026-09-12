/**
 * Pinned cabinet users in `localStorage`.
 *
 * The directory is long. Operators pin the records they return to.
 * The list is this machine's, not a server field: two admins can
 * pin different people without writing into `public.users`.
 */

export const ADMIN_PINNED_USERS_STORAGE_KEY = 'elmsafe.admin-pinned-users'

/** Reads pinned user ids, newest pin first. A corrupt record is empty. */
export function readPinnedUserIds(): readonly string[] {
  try {
    const raw = localStorage.getItem(ADMIN_PINNED_USERS_STORAGE_KEY)

    if (raw === null) {
      return []
    }

    const parsed: unknown = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return []
    }

    const ids: string[] = []
    const seen = new Set<string>()

    for (const value of parsed) {
      if (typeof value !== 'string') {
        continue
      }

      const id = value.trim()

      if (id === '' || seen.has(id)) {
        continue
      }

      seen.add(id)
      ids.push(id)
    }

    return ids
  } catch {
    return []
  }
}

export function writePinnedUserIds(ids: readonly string[]): void {
  try {
    localStorage.setItem(ADMIN_PINNED_USERS_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    /* No quota — the pins still live in this tab's state. */
  }
}

/** Pins `id` at the front. A repeat moves it to the front. */
export function pinUser(id: string): readonly string[] {
  const trimmed = id.trim()

  if (trimmed === '') {
    return readPinnedUserIds()
  }

  const next = [trimmed, ...readPinnedUserIds().filter((current) => current !== trimmed)]
  writePinnedUserIds(next)

  return next
}

export function unpinUser(id: string): readonly string[] {
  const next = readPinnedUserIds().filter((current) => current !== id.trim())
  writePinnedUserIds(next)

  return next
}
