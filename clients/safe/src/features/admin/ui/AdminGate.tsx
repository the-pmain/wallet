import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet } from 'react-router'

import { AdminClient, adminUnlockError } from '../model/AdminClient'
import { ADMIN_ROLE, type AdminRole } from '../model/admin-role'
import { AdminSessionContext } from '../model/admin-context'
import { readAdminName, writeAdminName } from '../model/admin-name'
import { clearAdminPin, readAdminPin, writeAdminPin } from '../model/admin-pin'
import { AdminPinForm, type IAdminPinSubmit } from './AdminPinForm'
import { AdminShell } from './AdminShell'

function createAdminClient(): AdminClient {
  const configured = import.meta.env.VITE_SERVER_URL?.trim() ?? ''

  return new AdminClient({ baseUrl: configured })
}

interface IUnlockIntent {
  readonly role: AdminRole
  readonly name: string | null
}

/**
 * Cabinet gate: PIN on the server, session in `localStorage`.
 *
 * Nested routes do not mount until the PIN is accepted. After that
 * the shell stays in place when opening a user profile. The admin
 * name is written only after a successful sign-in and is not
 * cleared on lock.
 */
export function AdminGate() {
  const client = useMemo(() => createAdminClient(), [])
  const intentRef = useRef<IUnlockIntent | null>(null)
  const unlockEpochRef = useRef(0)
  const [pin, setPin] = useState<string | null>(() => readAdminPin())
  const [role, setRole] = useState<AdminRole | null>(null)
  const [operatorName, setOperatorName] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setBusy] = useState(() => readAdminPin() !== null)
  const [pinFormKey, setPinFormKey] = useState(0)

  useEffect(() => {
    if (pin === null) {
      client.clearPin()

      return
    }

    let cancelled = false
    const epoch = unlockEpochRef.current

    void client
      .authenticate(pin)
      .then((nextRole) => {
        if (cancelled || epoch !== unlockEpochRef.current) {
          return
        }

        const intent = intentRef.current
        intentRef.current = null

        if (intent !== null && intent.role !== nextRole) {
          clearAdminPin()
          client.clearPin()
          setUnlocked(false)
          setRole(null)
          setOperatorName(null)
          setPin(null)
          setError('wrong')

          return
        }

        writeAdminPin(pin)

        if (nextRole === ADMIN_ROLE.Admin) {
          const name = intent?.name ?? readAdminName()

          if (intent?.name !== null && intent?.name !== undefined) {
            writeAdminName(intent.name)
          }

          setOperatorName(name)
        } else {
          setOperatorName(null)
        }

        setRole(nextRole)
        setError(null)
        setUnlocked(true)
      })
      .catch((caught: unknown) => {
        if (cancelled || epoch !== unlockEpochRef.current) {
          return
        }

        intentRef.current = null
        clearAdminPin()
        client.clearPin()
        setUnlocked(false)
        setRole(null)
        setOperatorName(null)
        setPin(null)
        setError(adminUnlockError(caught))
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [client, pin])

  const lock = useCallback(() => {
    unlockEpochRef.current += 1
    intentRef.current = null
    clearAdminPin()
    client.clearPin()
    setUnlocked(false)
    setRole(null)
    setOperatorName(null)
    setPin(null)
    setError(null)
    setBusy(false)
    setPinFormKey((key) => key + 1)
  }, [client])

  const session = useMemo(
    () =>
      role === null
        ? null
        : {
            client,
            role,
            canWrite: role === ADMIN_ROLE.Super,
            operatorName,
            lock,
          },
    [client, lock, operatorName, role],
  )

  const submitPin = (value: IAdminPinSubmit) => {
    intentRef.current = { role: value.role, name: value.name }
    setError(null)
    setBusy(true)
    setPin(value.pin)
  }

  if (pin === null || !unlocked || session === null) {
    return (
      <AdminPinForm
        key={pinFormKey}
        savedName={readAdminName()}
        error={error}
        isBusy={isBusy}
        onInteract={() => {
          setError(null)
        }}
        onSubmit={submitPin}
      />
    )
  }

  return (
    <AdminSessionContext.Provider value={session}>
      <AdminShell role={session.role} operatorName={operatorName} pin={pin} onLock={session.lock}>
        <Outlet />
      </AdminShell>
    </AdminSessionContext.Provider>
  )
}
