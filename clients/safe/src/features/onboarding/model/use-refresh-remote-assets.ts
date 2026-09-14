import { useEffect, useRef } from 'react'

import { useDirectorySession } from './directory-session'
import { readLoginCredentials } from './login-credentials'

/**
 * On entering the screen, fetches a fresh showcase via `GET /v1/users/:id`.
 *
 * The balance after a transfer debit lives in the directory record.
 * The session snapshot does not know it until this request returns.
 *
 * Depend on the user id, not the user object. `refresh()` always
 * writes a new snapshot; tying the effect to the object retried
 * `GET /v1/users/:id` forever.
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
