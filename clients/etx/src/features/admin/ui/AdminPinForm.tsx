import { Delete, Shield } from 'lucide-react'
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

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
  SegmentedControl,
  type ISegmentedOption,
} from '@/shared/ui'

import {
  SUPER_ADMIN_GLOW_DOT,
  SUPER_ADMIN_GLOW_ICON,
  SUPER_ADMIN_GLOW_TEXT,
} from '../model/admin-glow'
import { ADMIN_NAME_MAX_LENGTH } from '../model/admin-name'
import { ADMIN_ROLE, type AdminRole } from '../model/admin-role'

const PIN_LENGTH = 4

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

const ROLE_OPTIONS: readonly ISegmentedOption<AdminRole>[] = [
  { value: ADMIN_ROLE.Admin, label: 'Admin' },
  { value: ADMIN_ROLE.Super, label: 'Super Admin' },
]

export interface IAdminPinSubmit {
  readonly pin: string
  readonly role: AdminRole
  readonly name: string | null
}

interface AdminPinFormProps {
  readonly savedName?: string | null
  readonly error: string | null
  readonly isBusy: boolean
  readonly onInteract?: () => void
  readonly onSubmit: (value: IAdminPinSubmit) => void
}

/**
 * Первый экран кабинета: роль, имя для admin, затем PIN.
 *
 * Значение PIN сверяет сервер. Форма не знает правильного кода.
 * Имя роли admin живёт в `localStorage` и подставляется само.
 */
export function AdminPinForm({
  savedName = null,
  error,
  isBusy,
  onInteract,
  onSubmit,
}: AdminPinFormProps) {
  const pinId = useId()
  const nameId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const pinRef = useRef('')
  const nameValueRef = useRef(savedName ?? '')
  const [role, setRole] = useState<AdminRole>(ADMIN_ROLE.Admin)
  const [name, setName] = useState(savedName ?? '')
  const [pin, setPin] = useState('')

  const isAdmin = role === ADMIN_ROLE.Admin
  const trimmedName = name.trim()
  const nameReady = !isAdmin || trimmedName !== ''
  const pinLocked = isBusy || !nameReady
  nameValueRef.current = name

  useLayoutEffect(() => {
    if (error !== null) {
      pinRef.current = ''
      setPin('')
    }
  }, [error])

  useLayoutEffect(() => {
    if (isAdmin && nameValueRef.current.trim() === '') {
      nameRef.current?.focus()

      return
    }

    inputRef.current?.focus()
  }, [isAdmin])

  const clearError = () => {
    if (error !== null) {
      onInteract?.()
    }
  }

  const setDigits = (next: string, source: 'keypad' | 'input' = 'keypad') => {
    if (pinLocked) {
      return
    }

    const digits = next.replace(/\D/gu, '').slice(0, PIN_LENGTH)

    /* Менеджер паролей после Lock вставляет весь PIN одним событием.
       Клавиатура вводит по цифре. Сброс вставки, чтобы Lock не
       впускал оператора снова. */
    if (source === 'input' && pinRef.current.length === 0 && digits.length === PIN_LENGTH) {
      return
    }

    clearError()

    pinRef.current = digits
    setPin(digits)

    if (digits.length === PIN_LENGTH) {
      onSubmit({
        pin: digits,
        role,
        name: isAdmin ? trimmedName : null,
      })
    }
  }

  const pressDigit = (digit: string) => {
    setDigits(pinRef.current + digit)
    inputRef.current?.focus()
  }

  const title = isAdmin ? 'Admin' : 'Super Admin'
  const description = isAdmin
    ? 'Enter your name, then the PIN.'
    : 'Enter the PIN to manage users and wallet balances.'

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
        <CardContent>
          <div className="flex flex-col gap-4">
            <SegmentedControl
              legend="Role"
              size="sm"
              value={role}
              options={ROLE_OPTIONS}
              onChange={(next) => {
                clearError()
                pinRef.current = ''
                setPin('')
                setRole(next)
              }}
            />

            {isAdmin ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor={nameId}>Name</Label>
                <Input
                  ref={nameRef}
                  id={nameId}
                  type="text"
                  name="name"
                  autoComplete="off"
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
            ) : null}

            <div className="flex flex-col items-center gap-2.5">
              <div className="flex flex-col items-center gap-1.5">
                <Label htmlFor={pinId}>PIN</Label>
                <div className="flex items-center gap-2.5" aria-hidden>
                  {Array.from({ length: PIN_LENGTH }, (_, index) => (
                    <span
                      key={index}
                      className={cn(
                        'size-2.5 rounded-full border-2 transition-colors',
                        index < pin.length
                          ? isAdmin
                            ? 'border-white bg-white'
                            : SUPER_ADMIN_GLOW_DOT
                          : 'border-muted-foreground/35 bg-transparent',
                      )}
                    />
                  ))}
                </div>
              </div>
              {/* PIN — не пароль браузера. `type="password"` рядом с
                  именем заставляет Chrome сохранить его и вставить после
                  Lock, и оператор снова оказывается в кабинете. */}
              <input
                ref={inputRef}
                id={pinId}
                className="sr-only"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoCorrect="off"
                spellCheck={false}
                maxLength={PIN_LENGTH}
                value={pin}
                disabled={pinLocked}
                aria-invalid={error !== null}
                onChange={(event) => {
                  setDigits(event.target.value, 'input')
                }}
              />
              <p className="sr-only" aria-live="polite">
                {pin.length} of {PIN_LENGTH} digits entered
              </p>

              <div className="grid w-full grid-cols-3 gap-1.5" role="group" aria-label="PIN keypad">
                {DIGITS.map((digit) => (
                  <Key key={digit} disabled={pinLocked} onPress={() => pressDigit(digit)}>
                    {digit}
                  </Key>
                ))}
                <Key
                  muted
                  disabled={pinLocked}
                  ariaLabel="Clear"
                  onPress={() => {
                    setDigits('')
                    inputRef.current?.focus()
                  }}
                >
                  Clear
                </Key>
                <Key disabled={pinLocked} onPress={() => pressDigit('0')}>
                  0
                </Key>
                <Key
                  muted
                  disabled={pinLocked}
                  ariaLabel="Backspace"
                  onPress={() => {
                    setDigits(pinRef.current.slice(0, -1))
                    inputRef.current?.focus()
                  }}
                >
                  <Delete className="size-5" strokeWidth={1.75} aria-hidden />
                </Key>
              </div>
            </div>
            {error === 'wrong' ? (
              <Alert variant="warning">
                <AlertDescription>That PIN is not accepted.</AlertDescription>
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
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Key({
  children,
  ariaLabel,
  muted = false,
  disabled,
  onPress,
}: {
  readonly children: ReactNode
  readonly ariaLabel?: string
  readonly muted?: boolean
  readonly disabled: boolean
  readonly onPress: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(
        'h-12 rounded-lg text-lg font-semibold',
        muted && 'text-sm font-medium text-muted-foreground',
      )}
      onClick={onPress}
    >
      {children}
    </Button>
  )
}
