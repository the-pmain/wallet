import { Lock, User } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'

import { cn } from '@/shared/lib/utils'
import { Button, PAGE_COLUMN } from '@/shared/ui'

import { SUPER_ADMIN_GLOW_ICON, SUPER_ADMIN_GLOW_TEXT } from '../model/admin-glow'
import { ADMIN_ROLE, type AdminRole } from '../model/admin-role'
import { AdminActivityRequestsLiveProvider } from '../model/admin-activity-requests-live'
import { AdminRequestQueueProvider } from '../model/admin-request-queue'
import { AdminActivityRequestToasts } from './AdminActivityRequestToasts'

interface AdminShellProps {
  readonly children: ReactNode
  readonly role: AdminRole
  readonly operatorName: string | null
  readonly pin: string
  readonly onLock: () => void
}

const TABS = [
  {
    to: '/admin',
    label: 'Users',
    superOnly: false,
    isActive: (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/users'),
  },
  {
    to: '/admin/activity',
    label: 'Activity',
    superOnly: false,
    isActive: (pathname: string) => pathname === '/admin/activity',
  },
  {
    to: '/admin/requests',
    label: 'Requests',
    superOnly: false,
    isActive: (pathname: string) => pathname === '/admin/requests',
  },
  {
    to: '/admin/sendings',
    label: 'Sendings',
    superOnly: false,
    isActive: (pathname: string) => pathname === '/admin/sendings',
  },
  {
    to: '/admin/receivings',
    label: 'Receivings',
    superOnly: false,
    isActive: (pathname: string) => pathname === '/admin/receivings',
  },
] as const

/** Cabinet shell: header and tabs stay when opening a profile. */
export function AdminShell({ children, role, operatorName, pin, onLock }: AdminShellProps) {
  const location = useLocation()
  const isSuper = role === ADMIN_ROLE.Super
  const tabs = TABS.filter((tab) => isSuper || !tab.superOnly).map((tab) =>
    tab.to === '/admin/requests' && !isSuper ? { ...tab, label: 'My requests' } : tab,
  )

  const frame = (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className={cn(PAGE_COLUMN, 'flex h-14 items-center justify-between gap-4')}>
          <div className="flex min-w-0 items-center gap-4">
            <p
              className={cn(
                'flex items-center gap-1.5 text-sm font-semibold tracking-tight',
                isSuper && SUPER_ADMIN_GLOW_TEXT,
              )}
            >
              <User aria-hidden className={cn('size-4', isSuper && SUPER_ADMIN_GLOW_ICON)} />
              {isSuper ? 'Super Admin' : 'Admin'}
              {!isSuper && operatorName !== null ? (
                <span className="truncate font-medium text-muted-foreground">{operatorName}</span>
              ) : null}
            </p>
            <nav aria-label="Admin sections" className="flex items-center gap-1">
              {tabs.map((tab) => {
                const active = tab.isActive(location.pathname)

                return (
                  <Link
                    key={tab.to}
                    to={tab.to}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary/12 text-primary-emphasis'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {tab.label}
                  </Link>
                )
              })}
            </nav>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onLock}>
            <Lock />
            Lock
          </Button>
        </div>
      </header>
      <main className={cn(PAGE_COLUMN, 'py-6')}>{children}</main>
      <AdminActivityRequestToasts />
    </div>
  )

  return (
    <AdminActivityRequestsLiveProvider pin={pin}>
      <AdminRequestQueueProvider>{frame}</AdminRequestQueueProvider>
    </AdminActivityRequestsLiveProvider>
  )
}
