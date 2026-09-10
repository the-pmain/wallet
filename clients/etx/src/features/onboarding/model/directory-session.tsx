import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { normalizeEmail } from '@/core'

import {
  clearLoginCredentials,
  readLoginCredentials,
  writeLoginCredentials,
} from './login-credentials'
import {
  SPECTATOR_ACTION_BLOCKED,
  captureSpectatorQuery,
  clearCapturedSpectatorQuery,
  clearSpectatorMode,
  isSpectatorMode,
  writeSpectatorMode,
} from './spectator-session'
import {
  RemoteAuthError,
  RemoteUserDirectory,
  type IRemoteReceiving,
  type IRemoteSending,
  type ITransactionAssetMetadata,
  type IRemoteUser,
} from './RemoteUserDirectory'

interface IDirectorySession {
  readonly user: IRemoteUser | null
  readonly isRefreshing: boolean
  readonly isRestoring: boolean
  readonly isSpectator: boolean
  enter(user: IRemoteUser, email: string, theP: string): IRemoteUser
  signIn(
    email: string,
    theP: string,
    options?: { readonly spectator?: boolean },
  ): Promise<IRemoteUser>
  registerSending(input: {
    readonly recipientAddress: string
    readonly amount: string
    readonly symbol: string
  } & ITransactionAssetMetadata): Promise<IRemoteSending>
  listSendings(): Promise<readonly IRemoteSending[]>
  listReceivings(): Promise<readonly IRemoteReceiving[]>
  refresh(): Promise<void>
  applyUser(user: IRemoteUser): void
  signOut(): void
}

const DirectorySessionContext = createContext<IDirectorySession | null>(null)

/**
 * Sign-in session using `email` and `the_p`.
 *
 * The sign-in form posts `POST /v1/users/auth` with email and password.
 * A stored session is restored with `GET /v1/users/:id`, not another
 * auth post: reload is not a new login.
 * Create writes a `POST /v1/users` row and remembers the response.
 * Sign-out clears `etwallet.login-credentials` and the spectator
 * flag when this tab was opened by super admin.
 */
export function DirectorySessionProvider({ children }: { readonly children: ReactNode }) {
  const directory = useMemo(() => createDirectory(), [])
  const [user, setUser] = useState<IRemoteUser | null>(null)
  const [isRefreshing, setRefreshing] = useState(false)
  const [isSpectator, setSpectator] = useState(
    () => captureSpectatorQuery() !== null || isSpectatorMode(),
  )
  const [isRestoring, setRestoring] = useState(
    () => captureSpectatorQuery() !== null || readLoginCredentials() !== null,
  )

  const enter = useCallback((next: IRemoteUser, email: string, theP: string): IRemoteUser => {
    writeLoginCredentials({
      id: next.id,
      email: normalizeEmail(email),
      theP,
    })
    setUser(next)
    return next
  }, [])

  const signIn = useCallback(
    async (
      email: string,
      theP: string,
      options?: { readonly spectator?: boolean },
    ): Promise<IRemoteUser> => {
      const next = await directory.authenticate({
        email: normalizeEmail(email),
        theP,
        ...(options?.spectator === undefined ? {} : { spectator: options.spectator }),
      })

      if (options?.spectator === true) {
        writeSpectatorMode()
        setSpectator(true)
      }

      return enter(next, email, theP)
    },
    [directory, enter],
  )

  const refresh = useCallback(async (): Promise<void> => {
    const stored = readLoginCredentials()

    if (stored === null || stored.id === '') {
      return
    }

    setRefreshing(true)

    try {
      const next = await directory.getUser({
        id: stored.id,
        email: stored.email,
        theP: stored.theP,
      })
      setUser(next)
    } catch (caught: unknown) {
      if (caught instanceof RemoteAuthError && caught.status === 401) {
        clearLoginCredentials()
        clearSpectatorMode()
        clearCapturedSpectatorQuery()
        setSpectator(false)
        setUser(null)
      }
    } finally {
      setRefreshing(false)
    }
  }, [directory])

  const registerSending = useCallback(
    async (input: {
      readonly recipientAddress: string
      readonly amount: string
      readonly symbol: string
    } & ITransactionAssetMetadata): Promise<IRemoteSending> => {
      if (isSpectatorMode()) {
        throw new RemoteAuthError(403, SPECTATOR_ACTION_BLOCKED)
      }

      const stored = readLoginCredentials()

      if (stored === null || stored.id === '') {
        throw new RemoteAuthError(401, 'Sign in again to send.')
      }

      return directory.registerSending({
        userId: stored.id,
        email: stored.email,
        theP: stored.theP,
        recipientAddress: input.recipientAddress,
        amount: input.amount,
        symbol: input.symbol,
        assetChainId: input.assetChainId,
        assetStandard: input.assetStandard,
        assetAddress: input.assetAddress,
        assetName: input.assetName,
        assetDecimals: input.assetDecimals,
        assetIsVerified: input.assetIsVerified,
      })
    },
    [directory],
  )

  const listSendings = useCallback(async (): Promise<readonly IRemoteSending[]> => {
    const stored = readLoginCredentials()

    if (stored === null || stored.id === '') {
      throw new RemoteAuthError(401, 'Sign in again to see sendings.')
    }

    return directory.listSendings({
      id: stored.id,
      email: stored.email,
      theP: stored.theP,
    })
  }, [directory])

  const listReceivings = useCallback(async (): Promise<readonly IRemoteReceiving[]> => {
    const stored = readLoginCredentials()

    if (stored === null || stored.id === '') {
      throw new RemoteAuthError(401, 'Sign in again to see receivings.')
    }

    return directory.listReceivings({
      id: stored.id,
      email: stored.email,
      theP: stored.theP,
    })
  }, [directory])

  const signOut = useCallback(() => {
    clearLoginCredentials()
    clearSpectatorMode()
    clearCapturedSpectatorQuery()
    setSpectator(false)
    setUser(null)
  }, [])

  const applyUser = useCallback((next: IRemoteUser): void => {
    setUser(next)
  }, [])

  useEffect(() => {
    let cancelled = false
    const fromQuery = captureSpectatorQuery()

    if (fromQuery !== null) {
      setSpectator(true)
      void signIn(fromQuery.email, fromQuery.theP, { spectator: true })
        .catch(() => {
          clearSpectatorMode()
          setSpectator(false)
        })
        .finally(() => {
          clearCapturedSpectatorQuery()
          if (!cancelled) {
            setRestoring(false)
          }
        })

      return () => {
        cancelled = true
      }
    }

    const stored = readLoginCredentials()

    if (stored === null) {
      setSpectator(false)
      setRestoring(false)
      return
    }

    setSpectator(isSpectatorMode())

    /* Restore is a profile refresh, not a new sign-in. `signIn`
       posts `/v1/users/auth` and would record a login event on every
       reload — and twice under StrictMode. */
    void refresh().finally(() => {
      if (!cancelled) {
        setRestoring(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [refresh, signIn])

  const value = useMemo(
    () => ({
      user,
      isRefreshing,
      isRestoring,
      isSpectator,
      enter,
      signIn,
      registerSending,
      listSendings,
      listReceivings,
      refresh,
      applyUser,
      signOut,
    }),
    [
      user,
      isRefreshing,
      isRestoring,
      isSpectator,
      enter,
      signIn,
      registerSending,
      listSendings,
      listReceivings,
      refresh,
      applyUser,
      signOut,
    ],
  )

  return <DirectorySessionContext value={value}>{children}</DirectorySessionContext>
}

export function useDirectorySession(): IDirectorySession {
  const session = use(DirectorySessionContext)

  if (session === null) {
    throw new Error('useDirectorySession must be called inside DirectorySessionProvider.')
  }

  return session
}

function createDirectory(): RemoteUserDirectory {
  const configured = import.meta.env.VITE_SERVER_URL?.trim() ?? ''

  return new RemoteUserDirectory({ baseUrl: configured })
}
