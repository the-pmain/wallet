/**
 * Закреплённые записи кабинета в `localStorage`.
 *
 * Справочник длинный. Оператор закрепляет тех, к кому возвращается.
 * Список живёт на этой машине, не в поле сервера: два админа могут
 * закрепить разных людей, не записывая в `public.users`.
 */

export const ADMIN_PINNED_USERS_STORAGE_KEY = 'etwallet.admin-pinned-users'

/** Читает id закреплённых, новый пин первым. Повреждённая запись — пусто. */
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
    /* Нет квоты — пины этой вкладки всё равно в состоянии. */
  }
}

/** Ставит `id` в начало. Повтор поднимает его наверх. */
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
