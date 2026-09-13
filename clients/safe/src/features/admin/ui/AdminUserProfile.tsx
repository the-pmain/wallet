import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'

import type { IRemoteUser } from '@/features/onboarding/model/RemoteUserDirectory'
import { INITIAL_WALLET_VALUE } from '@/features/onboarding'
import { WALLET_CODENAME_RECEIVING_FUNDS_EXCHANGE } from '@/features/onboarding/model/RemoteUserDirectory'
import { cn } from '@/shared/lib/utils'
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  PasswordInput,
  SegmentedControl,
  Skeleton,
} from '@/shared/ui'

import { AdminAuthError } from '../model/AdminClient'
import { useAdminSession } from '../model/admin-context'
import { ADMIN_ROLE, type AdminRole } from '../model/admin-role'
import { listenForAdminUserRefresh } from '../model/admin-user-refresh'
import { AdminUserAssetsCard } from './AdminUserAssetsCard'
import { AdminActivityRequestsList } from './AdminActivityRequestsList'
import { AdminUserReceivingsTab, AdminUserSendingsTab } from './AdminUserTransferSections'
import { EtherscanWalletButton } from './EtherscanWalletButton'
import { SpectatorModeButton } from './SpectatorModeButton'
import { rowsToWallets, walletsToRows, type IAdminWalletRow } from './admin-wallets'
import { UserAvatar } from './UserAvatar'

const ADDRESS_SHAPE = /^0x[0-9a-fA-F]{40}$/u
const WALLET_NAME_SHAPE = /^[a-z0-9-]+$/u


const PROFILE_TAB = {
  Assets: 'assets',
  Sendings: 'sendings',
  Receivings: 'receivings',
  Requests: 'requests',
  Account: 'account',
  Wallets: 'wallets',
} as const

type ProfileTab = (typeof PROFILE_TAB)[keyof typeof PROFILE_TAB]

function profileTabs(role: AdminRole) {
  return [
    { value: PROFILE_TAB.Assets, label: 'Assets' },
    { value: PROFILE_TAB.Sendings, label: 'Sendings' },
    { value: PROFILE_TAB.Receivings, label: 'Receivings' },
    {
      value: PROFILE_TAB.Requests,
      label: role === ADMIN_ROLE.Admin ? 'My requests' : 'Requests',
    },
    { value: PROFILE_TAB.Account, label: 'Account' },
    { value: PROFILE_TAB.Wallets, label: 'Wallets' },
  ]
}

const PROFILE_TAB_VALUES = new Set<string>(Object.values(PROFILE_TAB))

function parseProfileTab(value: string | null): ProfileTab {
  if (value !== null && PROFILE_TAB_VALUES.has(value)) {
    return value as ProfileTab
  }

  return PROFILE_TAB.Assets
}

export function AdminUserProfile() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { client, lock } = useAdminSession()
  const [user, setUser] = useState<IRemoteUser | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (userId === undefined) {
      return
    }

    let cancelled = false

    void client
      .getUser(userId)
      .then((record) => {
        if (!cancelled) {
          setUser(record)
        }
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return
        }

        if (caught instanceof AdminAuthError && caught.status === 401) {
          lock()

          return
        }

        setLoadError(
          caught instanceof AdminAuthError && caught.status === 404 ? 'missing' : 'failed',
        )
      })

    return () => {
      cancelled = true
    }
  }, [client, lock, userId])

  useEffect(() => {
    if (userId === undefined) {
      return
    }

    return listenForAdminUserRefresh(userId, () => {
      void client
        .getUser(userId)
        .then(setUser)
        .catch((caught: unknown) => {
          if (caught instanceof AdminAuthError && caught.status === 401) {
            lock()
          }
        })
    })
  }, [client, lock, userId])

  if (loadError === 'missing') {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <Alert variant="danger">
          <AlertDescription>This user does not exist.</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (loadError !== null) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <Alert variant="danger">
          <AlertDescription>The profile could not be loaded.</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (user === null || userId === undefined) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <ProfileEditor
      key={user.id}
      user={user}
      onUpdated={setUser}
      onDeleted={() => {
        void navigate('/admin')
      }}
    />
  )
}

function ProfileEditor({
  user,
  onUpdated,
  onDeleted,
}: {
  readonly user: IRemoteUser
  readonly onUpdated: (user: IRemoteUser) => void
  readonly onDeleted: () => void
}) {
  const { client, lock, canWrite, role } = useAdminSession()
  const tabs = useMemo(() => profileTabs(role), [role])
  const emailId = useId()
  const balanceId = useId()
  const passwordId = useId()
  const walletsFormId = useId()
  const [email, setEmail] = useState(user.email ?? '')
  const [balance, setBalance] = useState(user.balance ?? '')
  const [password, setPassword] = useState('')
  const [newCodename, setNewCodename] = useState('')
  const [newKey, setNewKey] = useState('')
  const [wallets, setWallets] = useState<IAdminWalletRow[]>(() => walletsToRows(user.wallets ?? {}))

  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = parseProfileTab(searchParams.get('tab'))

  const setTab = (next: ProfileTab) => {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current)
        params.set('tab', next)

        return params
      },
      { replace: true },
    )
  }

  const run = async (
    key: string,
    work: () => Promise<IRemoteUser | void>,
    saved = 'Saved.',
  ) => {
    setBusy(key)
    setError(null)
    setMessage(null)

    try {
      const next = await work()

      if (next !== undefined) {
        onUpdated(next)
      }

      setMessage(saved)
    } catch (caught: unknown) {
      if (caught instanceof AdminAuthError && caught.status === 401) {
        lock()

        return
      }

      setError('The change could not be saved.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col">
      <div className="sticky top-14 z-10 -mx-4 -mt-6 flex flex-col gap-6 border-b bg-background px-4 pb-4 pt-6">
        <div className="flex flex-col gap-3">
          <BackLink />
          <div className="flex items-center gap-4">
            <UserAvatar userId={user.id} email={user.email} className="size-14" />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight">{user.email ?? 'User'}</h1>
              <p className="text-sm text-muted-foreground">
                id {user.id} · created {formatDate(user.createdAt)}
              </p>
            </div>
            <SpectatorModeButton email={user.email} theP={user.theP} />
          </div>
        </div>

        {error !== null ? (
          <Alert variant="danger">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {message !== null ? (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        <SegmentedControl
          legend="Profile section"
          value={tab}
          options={tabs}
          onChange={setTab}
        />
      </div>

      <div className="flex flex-col gap-6 pt-6">
      {tab === PROFILE_TAB.Assets ? (
        <AdminUserAssetsCard user={user} canWrite={canWrite} busy={busy} run={run} />
      ) : null}

      {tab === PROFILE_TAB.Sendings ? (
        <AdminUserSendingsTab user={user} onUserUpdated={onUpdated} />
      ) : null}

      {tab === PROFILE_TAB.Receivings ? (
        <AdminUserReceivingsTab user={user} onUserUpdated={onUpdated} />
      ) : null}

      {tab === PROFILE_TAB.Requests ? <AdminActivityRequestsList userId={user.id} /> : null}

      {tab === PROFILE_TAB.Account ? (
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {canWrite ? (
              <>
                <Field
                  id={emailId}
                  label="Email"
                  value={email}
                  onChange={setEmail}
                />
                <Field
                  id={balanceId}
                  label="Balance"
                  value={balance}
                  onChange={setBalance}
                />
                <ReadValue label="Password (the_p)" value={user.theP ?? ''} />
                <PasswordField
                  id={passwordId}
                  label="New password (the_p)"
                  value={password}
                  onChange={setPassword}
                />
                <Button
                  type="button"
                  disabled={busy !== null || email.trim() === '' || balance.trim() === ''}
                  onClick={() => {
                    void run('account', async () => {
                      const patch: { email: string; balance: string; theP?: string } = {
                        email: email.trim(),
                        balance: balance.trim(),
                      }

                      if (password.trim() !== '') {
                        patch.theP = password.trim()
                      }

                      const next = await client.updateUser(user.id, patch)
                      setPassword('')

                      return {
                        ...next,
                        theP: patch.theP ?? next.theP ?? user.theP,
                      }
                    })
                  }}
                >
                  {busy === 'account' ? 'Saving…' : 'Save account'}
                </Button>
              </>
            ) : (
              <>
                <ReadValue label="Email" value={email} />
                <ReadValue label="Balance" value={balance} />
                <ReadValue label="Password (the_p)" value={user.theP ?? ''} />
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === PROFILE_TAB.Wallets ? (
        <Card>
          <CardHeader>
            <CardTitle>Wallets (our wallets on which clients will send money)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {wallets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No addresses yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {wallets.map((entry, index) => (
                  <WalletSlotRow
                    key={entry.rowId}
                    codename={entry.codename}
                    address={entry.key}
                    editable={canWrite}
                    disabled={!canWrite || busy !== null}
                    canRemove={canWrite}
                    onAddressChange={(key) => {
                      setWallets((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, key } : item,
                        ),
                      )
                    }}
                    onRemove={() => {
                      setWallets((current) => current.filter((_, itemIndex) => itemIndex !== index))
                    }}
                  />
                ))}
              </ul>
            )}
            {canWrite ? (
              <div className="flex flex-col gap-3 rounded-lg border border-dashed p-3 sm:flex-row sm:items-end">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Label htmlFor={`${walletsFormId}-new-wallet-name`}>Wallet name</Label>
                  <Input
                    id={`${walletsFormId}-new-wallet-name`}
                    value={newCodename}
                    placeholder="exchange, cold, mock-wallet…"
                    disabled={busy !== null}
                    onChange={(event) => {
                      setNewCodename(event.target.value)
                    }}
                  />
                  {normalizeWalletName(newCodename) === '' ? (
                    <p className="text-xs text-muted-foreground">
                      Lowercase letters, digits, and hyphens.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Saved as {normalizeWalletName(newCodename)}.
                    </p>
                  )}
                  <Label htmlFor={`${walletsFormId}-new-wallet-address`}>Wallet address</Label>
                  <Input
                    id={`${walletsFormId}-new-wallet-address`}
                    value={newKey}
                    placeholder="0x…"
                    className="font-mono"
                    disabled={busy !== null}
                    onChange={(event) => {
                      setNewKey(event.target.value)
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    busy !== null ||
                    !WALLET_NAME_SHAPE.test(normalizeWalletName(newCodename)) ||
                    !ADDRESS_SHAPE.test(newKey.trim())
                  }
                  onClick={() => {
                    const codename = normalizeWalletName(newCodename)
                    const key = newKey.trim()
                    setWallets((current) => {
                      const without = current.filter((item) => item.codename !== codename)

                      return [
                        ...without,
                        {
                          rowId: codename,
                          codename,
                          key,
                          value: INITIAL_WALLET_VALUE,
                        },
                      ]
                    })
                    setNewCodename('')
                    setNewKey('')
                  }}
                >
                  <Plus />
                  Add
                </Button>
              </div>
            ) : null}
            {canWrite ? (
            <Button
              type="button"
              disabled={
                busy !== null ||
                wallets.some((entry) => entry.codename.trim() === '' || entry.key.trim() === '')
              }
              onClick={() => {
                void run('wallets', () =>
                  client.updateUser(user.id, {
                    wallets: rowsToWallets(wallets),
                  }),
                )
              }}
            >
              {busy === 'wallets' ? 'Saving…' : 'Save wallets'}
            </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {canWrite ? (
      <Card>
        <CardHeader>
          <CardTitle>Danger</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="destructive"
            disabled={busy !== null}
            onClick={() => {
              if (!window.confirm(`Delete ${user.email ?? user.id}? This cannot be undone.`)) {
                return
              }

              void run('delete', async () => {
                await client.deleteUser(user.id)
                onDeleted()
              })
            }}
          >
            {busy === 'delete' ? 'Deleting…' : 'Delete user'}
          </Button>
        </CardContent>
      </Card>
      ) : null}
      </div>
    </div>
  )
}

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
      <Link to="/admin">
        <ArrowLeft />
        All users
      </Link>
    </Button>
  )
}

function normalizeWalletName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
}

function isExchangeWalletCodename(codename: string): boolean {
  return codename === WALLET_CODENAME_RECEIVING_FUNDS_EXCHANGE
}

function WalletSlotRow({
  codename,
  address,
  disabled,
  editable = true,
  canRemove = true,
  onAddressChange,
  onRemove,
}: {
  readonly codename: string
  readonly address: string
  readonly disabled: boolean
  readonly editable?: boolean
  readonly canRemove?: boolean
  readonly onAddressChange: (address: string) => void
  readonly onRemove: () => void
}) {
  const highlighted = isExchangeWalletCodename(codename)

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-3',
        highlighted && 'border-primary/50 bg-primary/5',
      )}
    >
      <div className="flex gap-3 sm:items-center">
        <div className="min-w-0 flex-1">
          <WalletAddressGroup
            codename={codename}
            address={address}
            disabled={disabled}
            editable={editable}
            onAddressChange={onAddressChange}
          />
        </div>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="shrink-0"
            aria-label={`Remove ${codename}`}
            onClick={onRemove}
          >
            <Trash2 />
          </Button>
        ) : null}
      </div>
      <EtherscanWalletButton address={address} walletName={codename} />
    </li>
  )
}

function WalletAddressGroup({
  codename,
  address,
  disabled,
  editable = true,
  addressPlaceholder,
  onAddressChange,
  codenameControl,
}: {
  readonly codename: string
  readonly address: string
  readonly disabled: boolean
  readonly editable?: boolean
  readonly addressPlaceholder?: string
  readonly onAddressChange: (address: string) => void
  readonly codenameControl?: ReactNode
}) {
  const addressId = useId()
  const highlighted = isExchangeWalletCodename(codename)

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border shadow-xs focus-within:ring-2 focus-within:ring-ring/40',
        highlighted && 'border-primary/60 focus-within:ring-primary/30',
      )}
    >
      <div
        className={cn(
          'border-b bg-muted/40 px-3 py-2',
          highlighted && 'border-primary/25 bg-primary/10',
        )}
      >
        {codenameControl ?? (
          <p
            className={cn(
              'font-mono text-xs leading-snug break-all text-foreground/85',
              highlighted && 'font-medium text-primary-emphasis',
            )}
          >
            {codename}
          </p>
        )}
      </div>
      {editable ? (
        <Input
          id={addressId}
          value={address}
          disabled={disabled}
          placeholder={addressPlaceholder}
          aria-label={`Address for ${codename}`}
          className="rounded-none border-0 font-mono text-sm shadow-none focus-visible:ring-0"
          onChange={(event) => {
            onAddressChange(event.target.value)
          }}
        />
      ) : (
        <p className="px-3 py-2 font-mono text-sm break-all" aria-label={`Address for ${codename}`}>
          {address === '' ? '—' : address}
        </p>
      )}
    </div>
  )
}

function ReadValue({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-sm break-all">{value.trim() === '' ? '—' : value}</p>
    </div>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
}: {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        autoComplete="off"
        onChange={(event) => {
          onChange(event.target.value)
        }}
      />
    </div>
  )
}

function PasswordField({
  id,
  label,
  value,
  onChange,
}: {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <PasswordInput
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
      />
    </div>
  )
}

function formatDate(value: string): string {
  const parsed = Date.parse(value)

  if (Number.isNaN(parsed)) {
    return value
  }

  return new Date(parsed).toLocaleString()
}
