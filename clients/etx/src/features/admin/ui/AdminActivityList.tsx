import { ChevronDown, History } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router'

import { cn } from '@/shared/lib/utils'
import { Alert, AlertDescription, EmptyState, Input, Skeleton } from '@/shared/ui'

import { formatAdminTimestamp } from '../lib/format-admin-timestamp'
import { formatLoginLocation } from '../lib/format-login-location'
import { AdminAuthError, type IAdminLogin, type IAdminUserActivity } from '../model/AdminClient'
import { type IAdminPage } from '../model/admin-page'
import { useAdminSession } from '../model/admin-context'
import { loginHasRegisteredLocation } from '../model/activity-query'
import {
  directoryListIsBusy,
  useAdminDirectoryQuery,
} from '../model/use-admin-directory-query'
import { AdminDirectoryListPending } from './AdminDirectoryListPending'
import { AdminListPager } from './AdminListPager'
import { LoginLocationDetails } from './LoginLocationDetails'
import { UserAvatar } from './UserAvatar'

export function AdminActivityList() {
  const { client, lock } = useAdminSession()
  const { page, pageSize, query, search, setPage, setSearch } = useAdminDirectoryQuery()
  const [listed, setListed] = useState<IAdminPage<IAdminUserActivity> | null>(null)
  const [isFetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    setFetching(true)
    void client
      .listDirectoryActivity({ page, pageSize, q: query })
      .then((next) => {
        if (!cancelled) {
          setListed(next)
          setFetching(false)
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

        setError('The activity list could not be loaded.')
      })
      .finally(() => {
        if (!cancelled) {
          setFetching(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [client, lock, page, pageSize, query])

  if (error !== null) {
    return (
      <Alert variant="danger">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (listed === null) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  const authentications = listed.items.reduce((total, row) => total + row.loginCount, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground">
          {String(listed.total)} {listed.total === 1 ? 'user' : 'users'} · {String(authentications)}{' '}
          {authentications === 1 ? 'authentication' : 'authentications'}.
        </p>
      </div>
      <Input
        type="search"
        value={search}
        placeholder="Search email, user id, or location"
        aria-label="Search email, user id, or location"
        onChange={(event) => {
          setSearch(event.target.value)
        }}
      />
      {directoryListIsBusy(search, query, isFetching) ? (
        <AdminDirectoryListPending label="Searching activity" />
      ) : listed.items.length === 0 ? (
        listed.total === 0 && query.trim() === '' ? (
          <EmptyState
            icon={History}
            title="No activity yet"
            description="Successful app logins appear here after a user signs in."
          />
        ) : (
          <p className="text-sm text-muted-foreground">No users match this search.</p>
        )
      ) : (
        <ul className="divide-y rounded-xl border">
          {listed.items.map((row) => (
            <ActivityRow key={row.userId} row={row} />
          ))}
        </ul>
      )}
      {directoryListIsBusy(search, query, isFetching) ? null : (
        <AdminListPager
          page={listed.page}
          pageSize={listed.pageSize}
          total={listed.total}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}

function ActivityRow({ row }: { readonly row: IAdminUserActivity }) {
  const hasLogins = row.logins.length > 0
  const email = row.email ?? 'No email'
  const countLabel =
    row.loginCount === 1 ? '1 authentication' : `${String(row.loginCount)} authentications`

  const identity = (
    <span className="flex min-w-0 items-center gap-3">
      <UserAvatar userId={row.userId} email={row.email} />
      <span className="min-w-0">
        <span className={cn('block truncate font-medium', !hasLogins && 'text-muted-foreground')}>
          {email}
        </span>
        <span
          className={cn(
            'block truncate text-xs',
            hasLogins ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          id {row.userId} · {countLabel}
        </span>
      </span>
    </span>
  )

  if (!hasLogins) {
    return (
      <li>
        <Link
          to={`/admin/users/${row.userId}`}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-muted-foreground hover:bg-accent"
        >
          {identity}
          <span className="shrink-0 text-xs">Never signed in</span>
        </Link>
      </li>
    )
  }

  return (
    <li>
      <details className="group hover:bg-accent">
        <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 select-none [&::-webkit-details-marker]:hidden">
          {identity}
          <LastLogin login={row.logins[0]} />
        </summary>
        <ol className="ml-10 flex flex-col gap-2 border-l px-4 pb-3">
          {row.logins.map((login, index) => (
            <LoginEventRow key={login.id} login={login} isLatest={index === 0} />
          ))}
        </ol>
      </details>
    </li>
  )
}

function LastLogin({ login }: { readonly login: IAdminLogin | undefined }) {
  if (login === undefined) {
    return null
  }

  const place = formatLoginLocation(login.location)

  return (
    <span className="shrink-0 text-right">
      <time
        dateTime={login.createdAt}
        className="block text-sm font-medium text-foreground tabular-nums"
      >
        {formatAdminTimestamp(login.createdAt)}
      </time>
      {place !== null ? (
        <span className="mt-0.5 block max-w-[14rem] truncate text-xs text-muted-foreground">
          {place}
        </span>
      ) : null}
    </span>
  )
}

function LoginEventRow({
  login,
  isLatest,
}: {
  readonly login: IAdminLogin
  readonly isLatest: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  const place = formatLoginLocation(login.location)
  const registered = loginHasRegisteredLocation(login)
  const summary = (
    <>
      <time dateTime={login.createdAt} className="tabular-nums">
        {formatAdminTimestamp(login.createdAt)}
      </time>
      {place !== null ? (
        <span className={cn('text-muted-foreground', isLatest ? 'ml-2 text-sm' : 'ml-2 text-xs')}>
          {place}
        </span>
      ) : null}
      {isLatest ? <span className="ml-2 text-xs text-muted-foreground">latest</span> : null}
    </>
  )

  if (!registered || login.location === null) {
    return (
      <li className={cn('text-foreground', isLatest ? 'text-base' : 'text-sm')}>{summary}</li>
    )
  }

  const label = [
    formatAdminTimestamp(login.createdAt),
    place,
    isLatest ? 'latest' : null,
    expanded ? 'hide location details' : 'show location details',
  ]
    .filter((part): part is string => part !== null)
    .join(', ')

  return (
    <li className={cn('text-foreground', isLatest ? 'text-base' : 'text-sm')}>
      <button
        type="button"
        className="focus-ring -mx-1 flex w-full cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-accent/70"
        aria-expanded={expanded}
        aria-controls={detailsId}
        aria-label={label}
        onClick={() => {
          setExpanded((current) => !current)
        }}
      >
        <span className="min-w-0 flex-1">{summary}</span>
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            expanded && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {expanded ? <LoginLocationDetails detailsId={detailsId} location={login.location} /> : null}
    </li>
  )
}
