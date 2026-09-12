import { useEffect, useMemo, useState } from 'react'

import type { IRemoteUser } from '@/features/onboarding/model/RemoteUserDirectory'
import { Alert, AlertDescription, Input, Skeleton } from '@/shared/ui'

import { AdminAuthError } from '../model/AdminClient'
import { type IAdminPage } from '../model/admin-page'
import { useAdminSession } from '../model/admin-context'
import { pinUser, readPinnedUserIds, unpinUser } from '../model/admin-pinned-users'
import { userMatchesAdminQuery } from '../model/admin-query'
import { directoryListIsBusy, useAdminDirectoryQuery } from '../model/use-admin-directory-query'
import { AdminDirectoryListPending } from './AdminDirectoryListPending'
import { AdminListPager } from './AdminListPager'
import { AdminUserDirectoryCard } from './AdminUserDirectoryCard'

/**
 * Список всех записей `users`. Переход ведёт в профиль.
 * Закреплённые записи стоят над справочником.
 */
export function AdminUsersList() {
  const { client, lock } = useAdminSession()
  const { page, pageSize, query, search, setPage, setSearch } = useAdminDirectoryQuery()
  const [listed, setListed] = useState<IAdminPage<IRemoteUser> | null>(null)
  const [isFetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pinnedIds, setPinnedIds] = useState<readonly string[]>(() => readPinnedUserIds())
  const [pinnedUsers, setPinnedUsers] = useState<readonly IRemoteUser[]>([])

  useEffect(() => {
    let cancelled = false

    setFetching(true)
    void client
      .listDirectoryUsers({ page, pageSize, q: query })
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

        setError('The user list could not be loaded.')
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

  useEffect(() => {
    if (listed === null || pinnedIds.length === 0) {
      setPinnedUsers([])

      return
    }

    const present = new Map(listed.items.map((user) => [user.id, user]))
    const missing = pinnedIds.filter((id) => !present.has(id))

    if (missing.length === 0) {
      setPinnedUsers(
        pinnedIds.flatMap((id) => {
          const user = present.get(id)

          return user === undefined ? [] : [user]
        }),
      )

      return
    }

    let cancelled = false

    void Promise.all(
      missing.map(async (id) => {
        try {
          return await client.getUser(id)
        } catch (caught: unknown) {
          if (caught instanceof AdminAuthError && caught.status === 401) {
            lock()
          }

          if (caught instanceof AdminAuthError && caught.status === 404 && !cancelled) {
            setPinnedIds(unpinUser(id))
          }

          return null
        }
      }),
    ).then((fetched) => {
      if (cancelled) {
        return
      }

      const extra = new Map(
        fetched.flatMap((user) => (user === null ? [] : [[user.id, user] as const])),
      )
      setPinnedUsers(
        pinnedIds.flatMap((id) => {
          const user = present.get(id) ?? extra.get(id)

          return user === undefined ? [] : [user]
        }),
      )
    })

    return () => {
      cancelled = true
    }
  }, [client, listed, lock, pinnedIds])

  const pinnedIdSet = useMemo(() => new Set(pinnedIds), [pinnedIds])
  const visiblePinned = pinnedUsers.filter((user) => userMatchesAdminQuery(user, query))
  const directoryUsers = (listed?.items ?? []).filter((user) => !pinnedIdSet.has(user.id))

  const togglePin = (userId: string) => {
    setPinnedIds(pinnedIdSet.has(userId) ? unpinUser(userId) : pinUser(userId))
  }

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

  const listBusy = directoryListIsBusy(search, query, isFetching)
  const directoryEmpty = !listBusy && visiblePinned.length === 0 && directoryUsers.length === 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          {String(listed.total)} {listed.total === 1 ? 'record' : 'records'}
          {query.trim() === '' ? ' in the directory.' : ' match this search.'}
        </p>
      </div>
      <Input
        type="search"
        value={search}
        placeholder="Search email or Wallet address"
        aria-label="Search email or Wallet address"
        onChange={(event) => {
          setSearch(event.target.value)
        }}
      />
      {listBusy ? (
        <AdminDirectoryListPending label="Searching users" />
      ) : directoryEmpty ? (
        <p className="text-sm text-muted-foreground">No users match this search.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {visiblePinned.length === 0 ? null : (
            <section className="flex flex-col gap-2" aria-labelledby="pinned-users-heading">
              <h2 id="pinned-users-heading" className="text-sm font-medium">
                Pinned
              </h2>
              <ul className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                {visiblePinned.map((user) => (
                  <li key={user.id} className="min-w-0">
                    <AdminUserDirectoryCard
                      user={user}
                      pinned
                      className="h-full min-w-0 overflow-hidden rounded-xl border"
                      onTogglePin={togglePin}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {directoryUsers.length === 0 ? null : (
            <ul className="divide-y overflow-hidden rounded-xl border">
              {directoryUsers.map((user) => (
                <li key={user.id}>
                  <AdminUserDirectoryCard user={user} pinned={false} onTogglePin={togglePin} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {listBusy ? null : (
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
