import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet } from 'react-router'

import { AdminClient, adminUnlockError } from '../model/AdminClient'
import { ADMIN_ROLE, type AdminRole } from '../model/admin-role'
import { AdminSessionContext } from '../model/admin-context'
import { readAdminName, writeAdminName } from '../model/admin-name'
import { clearAdminPass, readAdminPass, writeAdminPass } from '../model/admin-pass'
import { AdminPassForm, type IAdminPassSubmit } from './AdminPassForm'
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
 * Cabinet gate: password on the server, session in `localStorage`.
 *
 * Nested routes do not mount until the password is accepted. After that
 * the shell stays in place when opening a user profile. The admin
 * name is written only after a successful sign-in and is not
 * cleared on lock.
 */
export function AdminGate() {
  const client = useMemo(() => createAdminClient(), [])
  const intentRef = useRef<IUnlockIntent | null>(null)
  const unlockEpochRef = useRef(0)
  const [pass, setPass] = useState<string | null>(() => readAdminPass())
  const [role, setRole] = useState<AdminRole | null>(null)
  const [operatorName, setOperatorName] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setBusy] = useState(() => readAdminPass() !== null)
  const [passFormKey, setPassFormKey] = useState(0)

  useEffect(() => {
    if (pass === null) {
      client.clearPass()

      return
    }

    let cancelled = false
    const epoch = unlockEpochRef.current

    void client
      .authenticate(pass)
      .then((nextRole) => {
        if (cancelled || epoch !== unlockEpochRef.current) {
          return
        }

        const intent = intentRef.current
        intentRef.current = null

        if (intent !== null && intent.role !== nextRole) {
          clearAdminPass()
          client.clearPass()
          setUnlocked(false)
          setRole(null)
          setOperatorName(null)
          setPass(null)
          setError('wrong')

          return
        }

        writeAdminPass(pass)

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
        clearAdminPass()
        client.clearPass()
        setUnlocked(false)
        setRole(null)
        setOperatorName(null)
        setPass(null)
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
  }, [client, pass])

  const lock = useCallback(() => {
    unlockEpochRef.current += 1
    intentRef.current = null
    clearAdminPass()
    client.clearPass()
    setUnlocked(false)
    setRole(null)
    setOperatorName(null)
    setPass(null)
    setError(null)
    setBusy(false)
    setPassFormKey((key) => key + 1)
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

  const submitPass = (value: IAdminPassSubmit) => {
    intentRef.current = { role: value.role, name: value.name }
    setError(null)
    setBusy(true)
    setPass(value.pass)
  }

  if (pass === null || !unlocked || session === null) {
    return (
      <AdminPassForm
        key={passFormKey}
        savedName={readAdminName()}
        error={error}
        isBusy={isBusy}
        onInteract={() => {
          setError(null)
        }}
        onSubmit={submitPass}
      />
    )
  }

  return (
    <AdminSessionContext.Provider value={session}>
      <AdminShell role={session.role} operatorName={operatorName} pass={pass} onLock={session.lock}>
        <Outlet />
      </AdminShell>
    </AdminSessionContext.Provider>
  )
}
