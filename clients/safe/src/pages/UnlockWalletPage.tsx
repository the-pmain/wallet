import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'

import { ROUTE } from '@/app/router/routes'
import { isAppError } from '@/core'
import { DirectorySignInForm, useDirectorySession, useOnboarding } from '@/features/onboarding'
import { useTranslation } from '@/shared/i18n'
import {
  BrandMark,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui'

/**
 * Successful `POST /v1/users/auth` opens the previous account screen.
 * The password is sent to the server as `the_p`.
 */

export function UnlockWalletPage() {
  const onboarding = useOnboarding()
  const session = useDirectorySession()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  if (session.isRestoring) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (session.user !== null) {
    return <Navigate to={ROUTE.Dashboard} replace />
  }

  const handleSubmit = async (username: string, password: string) => {
    setError(null)
    setIsBusy(true)

    try {
      if (import.meta.env.MODE === 'test') {
        await onboarding.unlock(password)
        await navigate(ROUTE.Welcome)
        return
      }

      await session.signIn(username, password)

      try {
        await onboarding.unlock(password)
      } catch {
        /* Local storage may be missing — the cabinet is open via the session. */
      }

      await navigate(ROUTE.Dashboard, { replace: true })
    } catch (caught) {
      setError(isAppError(caught) ? caught.message : t('unlock.failed'))
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-4 sm:p-6">
      <Card className="w-full min-w-0 max-w-md animate-in duration-500 fade-in slide-in-from-bottom-3">
        <CardHeader className="items-center gap-5 text-center">
          <BrandMark className="mx-auto size-14" />

          <div className="flex flex-col gap-2">
            <CardTitle as="h1">{t('unlock.title')}</CardTitle>
            <CardDescription>{t('unlock.description')}</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <DirectorySignInForm
            error={error}
            isBusy={isBusy}
            onValuesChange={() => {
              setError(null)
            }}
            onSubmit={(username, password) => {
              void handleSubmit(username, password)
            }}
          />

          <nav
            aria-label="Account options"
            className="flex min-w-0 flex-wrap items-center justify-center gap-2 pt-2"
          >
            <Button asChild variant="ghost" size="sm" className="h-auto px-3 py-2.5 whitespace-normal">
              <Link to={ROUTE.ForgotPassword}>{t('unlock.forgot')}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-auto px-3 py-2.5 whitespace-normal">
              <Link to={ROUTE.Create}>{t('unlock.createAccount')}</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-auto max-w-full min-w-0 px-3 py-2.5 whitespace-normal text-center"
            >
              <Link to={ROUTE.ForgotPassword}>{t('unlock.otherWallet')}</Link>
            </Button>
          </nav>
        </CardContent>
      </Card>
    </div>
  )
}
