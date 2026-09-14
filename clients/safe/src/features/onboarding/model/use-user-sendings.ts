import { useCallback, useEffect, useState } from 'react'

import { useDirectorySession } from './directory-session'
import { readLoginCredentials } from './login-credentials'
import type { IRemoteSending } from './RemoteUserDirectory'

export interface IUserSendings {
  readonly sendings: readonly IRemoteSending[]
  readonly isLoading: boolean
  readonly error: string | null
  refresh(): Promise<void>
}

/**
 * Transfers for the current sign-in: only `GET /v1/users/:id/sendings`.
 *
 * `listSendings` is stable. The whole session object is not: every
 * profile refresh rebuilds it and would re-list transfers.
 */
export function useUserSendings(enabled = true): IUserSendings {
  const { user, listSendings } = useDirectorySession()
  const credentials = readLoginCredentials()
  const userId = user?.id ?? credentials?.id ?? null
  const [sendings, setSendings] = useState<readonly IRemoteSending[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    if (readLoginCredentials() === null) {
      setError(null)
      return
    }

    try {
      const listed = await listSendings()
      setSendings(listed)
      setError(null)
    } catch {
      setError('The sendings list could not be loaded.')
    }
  }, [listSendings])

  useEffect(() => {
    if (!enabled) {
      return
    }

    void refresh()
  }, [enabled, refresh, userId])

  return {
    sendings: sendings ?? [],
    isLoading: enabled && userId !== null && sendings === null && error === null,
    error,
    refresh,
  }
}
