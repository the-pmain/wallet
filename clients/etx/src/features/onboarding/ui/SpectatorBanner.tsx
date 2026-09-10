import { Ghost } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

import { useDirectorySession } from '../model/directory-session'

/**
 * Permanent spectator chrome. Ghost colours so the admin never
 * mistakes this tab for the user's real session.
 */
export function SpectatorBanner({ className }: { readonly className?: string }) {
  const { isSpectator } = useDirectorySession()

  if (!isSpectator) {
    return null
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className={cn(
        'border-b border-dashed border-muted-foreground/35 bg-muted/50 text-muted-foreground',
        className,
      )}
    >
      <div className="flex w-full items-center justify-center gap-2 px-4 py-1.5">
        <Ghost className="size-3.5 shrink-0 opacity-70" aria-hidden />
        <p className="text-center text-xs font-medium tracking-wide uppercase">
          You are in spectator mode
        </p>
      </div>
    </aside>
  )
}

export function SpectatorMark({ className }: { readonly className?: string }) {
  const { isSpectator } = useDirectorySession()

  if (!isSpectator) {
    return null
  }

  return (
    <span
      className={
        className ??
        'inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 bg-muted/30 px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase'
      }
    >
      <Ghost className="size-3 opacity-70" aria-hidden />
      Spectator
    </span>
  )
}
