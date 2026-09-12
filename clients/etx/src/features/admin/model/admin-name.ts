/**
 * Имя оператора кабинета в `localStorage`.
 *
 * Нужно только роли admin: после успешного входа сюда пишется
 * предъявленное имя, и форма подставляет его при следующем заходе.
 * Другое имя при входе перезаписывает запись. Super admin имя не
 * спрашивает и эту запись не трогает.
 */

export const ADMIN_NAME_STORAGE_KEY = 'etwallet.admin-name'

export const ADMIN_NAME_MAX_LENGTH = 64

/** Читает сохранённое имя. Повреждённая запись считается отсутствием. */
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

/** Пишет имя после успешного входа роли admin. Пустое значение игнорируется. */
export function writeAdminName(name: string): void {
  const trimmed = name.trim().slice(0, ADMIN_NAME_MAX_LENGTH)

  if (trimmed === '') {
    return
  }

  try {
    localStorage.setItem(ADMIN_NAME_STORAGE_KEY, trimmed)
  } catch {
    /* Нет квоты — сессия этой вкладки всё равно открыта. */
  }
}

/** Стирает сохранённое имя. */
export function clearAdminName(): void {
  try {
    localStorage.removeItem(ADMIN_NAME_STORAGE_KEY)
  } catch {
    /* Нет хранилища — нечего стирать. */
  }
}
