import { useEffect, useRef } from 'react'

import { useDirectorySession } from './directory-session'
import { readLoginCredentials } from './login-credentials'

/**
 * При входе на экран запрашивает свежую витрину `GET /v1/users/:id`.
 *
 * Баланс после списания перевода живёт в записи справочника.
 * Снимок сессии его не знает, пока этот запрос не вернётся.
 *
 * Зависимость — id пользователя, не объект. `refresh()` всегда
 * пишет новый снимок; привязка эффекта к объекту крутила
 * `GET /v1/users/:id` без остановки.
 */
export function useRefreshRemoteAssets(): void {
  const directory = useDirectorySession()
  const userId = directory.user?.id ?? null
  const refreshedForId = useRef<string | null>(null)

  useEffect(() => {
    if (directory.isSpectator && userId === null) {
      return
    }

    const stored = readLoginCredentials()

    if (stored === null || stored.id === '') {
      refreshedForId.current = null
      return
    }

    if (refreshedForId.current === stored.id) {
      return
    }

    refreshedForId.current = stored.id
    void directory.refresh()
  }, [directory.isSpectator, directory.refresh, userId])
}
