import { ChevronRight, Pin } from 'lucide-react'
import { Link } from 'react-router'

import type { IRemoteUser } from '@/features/onboarding/model/RemoteUserDirectory'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui'

import { UserAvatar } from './UserAvatar'

interface AdminUserDirectoryCardProps {
  readonly user: IRemoteUser
  readonly pinned: boolean
  readonly onTogglePin: (userId: string) => void
  readonly className?: string
}

function pinControlWho(user: IRemoteUser): string {
  return user.email === null || user.email === '' ? `user ${user.id}` : user.email
}

function pinControlName(user: IRemoteUser, pinned: boolean): string {
  const who = pinControlWho(user)

  return pinned ? `Unpin ${who}` : `Pin ${who}`
}

function pinControlHint(user: IRemoteUser, pinned: boolean): string {
  const who = pinControlWho(user)

  return pinned
    ? `Unpin ${who} — they go back into the directory list`
    : `Pin ${who} above the directory`
}

/**
 * One directory row: open the profile, or pin it above the list.
 *
 * The pin is a button, not a nested control inside the link. A
 * button inside a link is not a link and not a button.
 */
export function AdminUserDirectoryCard({
  user,
  pinned,
  onTogglePin,
  className,
}: AdminUserDirectoryCardProps) {
  const walletCount = Object.keys(user.wallets).length

  return (
    <div className={cn('flex items-stretch overflow-hidden', className)}>
      <Link
        to={`/admin/users/${user.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-accent"
      >
        <UserAvatar userId={user.id} email={user.email} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{user.email ?? 'No email'}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {String(walletCount)} wallets
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
      <Button
        type="button"
        variant="ghost"
        className="h-auto min-h-10 w-12 shrink-0 self-stretch rounded-none px-0"
        aria-pressed={pinned}
        aria-label={pinControlName(user, pinned)}
        title={pinControlHint(user, pinned)}
        onClick={() => {
          onTogglePin(user.id)
        }}
      >
        <Pin
          className={cn(
            'size-4',
            pinned ? 'fill-red-500 text-red-500' : 'text-muted-foreground',
          )}
          aria-hidden
        />
      </Button>
    </div>
  )
}
