import { Ghost } from 'lucide-react'

import { buildSpectatorHref } from '@/features/onboarding/model/spectator-session'
import { Button } from '@/shared/ui'

const GHOST_CLASS =
  'border border-dashed border-muted-foreground/40 bg-muted/25 text-muted-foreground shadow-none hover:bg-muted/45 hover:text-muted-foreground'

export function SpectatorModeButton({
  email,
  theP,
}: {
  readonly email: string | null
  readonly theP?: string
}) {
  const canOpen =
    email !== null && email.trim() !== '' && typeof theP === 'string' && theP !== ''

  if (!canOpen) {
    return (
      <Button type="button" variant="ghost" disabled className={GHOST_CLASS}>
        <Ghost className="opacity-70" aria-hidden />
        Spectator mode
      </Button>
    )
  }

  return (
    <Button asChild variant="ghost" className={GHOST_CLASS}>
      <a
        href={buildSpectatorHref(window.location.origin, {
          email: email.trim(),
          theP,
        })}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Ghost className="opacity-70" aria-hidden />
        Spectator mode
      </a>
    </Button>
  )
}
