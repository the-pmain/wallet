import { Shield } from 'lucide-react'
import { useId, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'

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
  type ISegmentedOption,
} from '@/shared/ui'

import { SUPER_ADMIN_GLOW_ICON, SUPER_ADMIN_GLOW_TEXT } from '../model/admin-glow'
import { ADMIN_NAME_MAX_LENGTH } from '../model/admin-name'
import { ADMIN_ROLE, type AdminRole } from '../model/admin-role'

const ROLE_OPTIONS: readonly ISegmentedOption<AdminRole>[] = [
  { value: ADMIN_ROLE.Admin, label: 'Admin' },
  { value: ADMIN_ROLE.Super, label: 'Super Admin' },
]

const SUPER_ADMIN_USERNAME = 'Super Admin'

export interface IAdminPassSubmit {
  readonly pass: string
  readonly role: AdminRole
  readonly name: string | null
}

interface AdminPassFormProps {
  readonly savedName?: string | null
  readonly error: string | null
  readonly isBusy: boolean
  readonly onInteract?: () => void
  readonly onSubmit: (value: IAdminPassSubmit) => void
}

/**
 * First cabinet screen: role, then a separate sign-in form per role.
 *
 * Admin and Super Admin are different `<form>` elements so the browser
 * password manager stores each password on its own username.
 */
export function AdminPassForm({
  savedName = null,
  error,
  isBusy,
  onInteract,
  onSubmit,
}: AdminPassFormProps) {
  const adminPassId = useId()
  const superPassId = useId()
  const nameId = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const nameValueRef = useRef(savedName ?? '')
  const [role, setRole] = useState<AdminRole>(ADMIN_ROLE.Admin)
  const [name, setName] = useState(savedName ?? '')
  const [pass, setPass] = useState('')

  const isAdmin = role === ADMIN_ROLE.Admin
  const trimmedName = name.trim()
  const nameReady = !isAdmin || trimmedName !== ''
  const passLocked = isBusy || !nameReady
  const canSubmit = nameReady && pass.trim() !== '' && !isBusy
  nameValueRef.current = name

  useLayoutEffect(() => {
    if (error !== null) {
      setPass('')
    }
  }, [error])

  useLayoutEffect(() => {
    if (isAdmin && nameValueRef.current.trim() === '') {
      nameRef.current?.focus()
    }
  }, [isAdmin])

  const clearError = () => {
    if (error !== null) {
      onInteract?.()
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canSubmit) {
      return
    }

    onSubmit({
      pass: pass.trim(),
      role,
      name: isAdmin ? trimmedName : null,
    })
  }

  const title = isAdmin ? 'Admin' : 'Super Admin'
  const description = isAdmin
    ? 'Enter your name, then the password.'
    : 'Enter the password to manage users and wallet balances.'

  const footer = (
    <SignInFooter error={error} isBusy={isBusy} canSubmit={canSubmit} />
  )

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-[22rem] gap-4 py-5">
        <CardHeader className="gap-3">
          <div
            className={cn(
              'flex size-9 items-center justify-center rounded-lg',
              isAdmin ? 'bg-primary/10 text-primary' : SUPER_ADMIN_GLOW_TEXT,
            )}
          >
            <Shield className={cn('size-4', !isAdmin && SUPER_ADMIN_GLOW_ICON)} aria-hidden />
          </div>
          <div className="flex flex-col gap-1">
            <CardTitle as="h1" className={cn(!isAdmin && SUPER_ADMIN_GLOW_TEXT)}>
              {title}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SegmentedControl
            legend="Role"
            size="sm"
            value={role}
            options={ROLE_OPTIONS}
            onChange={(next) => {
              clearError()
              setPass('')
              setRole(next)
            }}
          />

          {isAdmin ? (
            <form
              id="admin-sign-in"
              name="admin-sign-in"
              method="post"
              action="/admin/auth/admin"
              autoComplete="on"
              className="flex flex-col gap-4"
              onSubmit={handleSubmit}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor={nameId}>Name</Label>
                <Input
                  ref={nameRef}
                  id={nameId}
                  type="text"
                  name="admin-username"
                  autoComplete="username"
                  autoCapitalize="words"
                  autoCorrect="off"
                  maxLength={ADMIN_NAME_MAX_LENGTH}
                  value={name}
                  disabled={isBusy}
                  onChange={(event) => {
                    clearError()
                    setName(event.target.value)
                  }}
                />
              </div>
              <PasswordField
                id={adminPassId}
                name="admin-password"
                value={pass}
                disabled={passLocked}
                invalid={error !== null}
                onChange={(value) => {
                  clearError()
                  setPass(value)
                }}
              />
              {footer}
            </form>
          ) : (
            <form
              id="super-admin-sign-in"
              name="super-admin-sign-in"
              method="post"
              action="/admin/auth/super"
              autoComplete="on"
              className="flex flex-col gap-4"
              onSubmit={handleSubmit}
            >
              <input
                type="text"
                name="super-admin-username"
                autoComplete="username"
                autoCapitalize="off"
                autoCorrect="off"
                value={SUPER_ADMIN_USERNAME}
                readOnly
                tabIndex={-1}
                aria-hidden
                className="sr-only"
              />
              <PasswordField
                id={superPassId}
                name="super-admin-password"
                value={pass}
                disabled={passLocked}
                invalid={error !== null}
                onChange={(value) => {
                  clearError()
                  setPass(value)
                }}
              />
              {footer}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PasswordField({
  id,
  name,
  value,
  disabled,
  invalid,
  onChange,
}: {
  readonly id: string
  readonly name: string
  readonly value: string
  readonly disabled: boolean
  readonly invalid: boolean
  readonly onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Password</Label>
      <PasswordInput
        id={id}
        name={name}
        value={value}
        disabled={disabled}
        autoComplete="current-password"
        spellCheck={false}
        maxLength={256}
        aria-invalid={invalid}
        onChange={(event) => {
          onChange(event.target.value)
        }}
      />
    </div>
  )
}

function SignInFooter({
  error,
  isBusy,
  canSubmit,
}: {
  readonly error: string | null
  readonly isBusy: boolean
  readonly canSubmit: boolean
}): ReactNode {
  return (
    <>
      {error === 'wrong' ? (
        <Alert variant="warning">
          <AlertDescription>That password is not accepted.</AlertDescription>
        </Alert>
      ) : null}
      {error === 'address' ? (
        <Alert variant="warning">
          <AlertDescription>This IP address is not allowed.</AlertDescription>
        </Alert>
      ) : null}
      {error === 'unavailable' ? (
        <Alert variant="warning">
          <AlertDescription>The admin service is unavailable.</AlertDescription>
        </Alert>
      ) : null}
      {isBusy && error === null ? (
        <p className="text-center text-sm text-muted-foreground">Checking…</p>
      ) : null}
      <Button type="submit" disabled={!canSubmit}>
        Sign in
      </Button>
    </>
  )
}
