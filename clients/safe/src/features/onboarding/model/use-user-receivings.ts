import { useCallback, useEffect, useState } from 'react'

import { useDirectorySession } from './directory-session'
import { readLoginCredentials } from './login-credentials'
import type { IRemoteReceiving } from './RemoteUserDirectory'

export interface IUserReceivings {
  readonly receivings: readonly IRemoteReceiving[]
  readonly isLoading: boolean
  readonly error: string | null
  refresh(): Promise<void>
}

/**
 * Deposits for the current sign-in: only `GET /v1/users/:id/receivings`.
 *
 * `listReceivings` is stable. The whole session object is not: every
 * profile refresh rebuilds it and would re-list deposits.
 */
export function useUserReceivings(enabled = true): IUserReceivings {
  const { user, listReceivings } = useDirectorySession()
  const credentials = readLoginCredentials()
  const userId = user?.id ?? credentials?.id ?? null
  const [receivings, setReceivings] = useState<readonly IRemoteReceiving[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    if (readLoginCredentials() === null) {
      setError(null)
      return
    }

    try {
      const listed = await listReceivings()
      setReceivings(listed)
      setError(null)
    } catch {
      setError('The receivings list could not be loaded.')
    }
  }, [listReceivings])

  useEffect(() => {
    if (!enabled) {
      return
    }

    void refresh()
  }, [enabled, refresh, userId])

  return {
    receivings: receivings ?? [],
    isLoading: enabled && userId !== null && receivings === null && error === null,
    error,
    refresh,
  }
}
