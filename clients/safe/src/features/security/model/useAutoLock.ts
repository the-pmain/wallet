import { AutoLockService, type IClock } from '@/core'
import { useEffect, useMemo } from 'react'

/**
 * Browser events treated as a sign the user is present.
 *
 * Pointer move is left out on purpose: the cursor moves from an
 * accidental bump of the desk, and auto-lock extended by that
 * would never fire on a laptop left open.
 */
const ACTIVITY_EVENTS: readonly string[] = ['pointerdown', 'keydown', 'wheel', 'touchstart']

export interface IUseAutoLockParams {
  /** The countdown runs only on an unlocked wallet. */
  readonly isUnlocked: boolean

  readonly timeoutMs: number
  readonly clock: IClock

  readonly onExpire: () => void
}

/**
 * Wire auto-lock to the browser.
 *
 * THE CORE COUNTS TIME; THIS HOOK LISTENS TO THE BROWSER. The split
 * keeps `AutoLockService` usable in a service worker, where there is
 * no DOM and no input events.
 *
 * MOVING THE TAB TO THE BACKGROUND COUNTS AS IDLE, NOT ACTIVITY.
 * The opposite reading would extend the session on every window
 * switch — exactly when the user walked away from the wallet.
 *
 * EVENTS ARE LISTENED IN THE CAPTURE PHASE. A handler that stopped
 * bubbling would otherwise cancel the session extension, and the
 * wallet would lock mid-work.
 */
export function useAutoLock({ isUnlocked, timeoutMs, clock, onExpire }: IUseAutoLockParams): void {
  const service = useMemo(() => new AutoLockService({ clock }, { timeoutMs }), [clock, timeoutMs])

  useEffect(() => {
    if (!isUnlocked) {
      service.stop()

      return
    }

    const unsubscribeExpired = service.on('autolock:expired', () => {
      onExpire()
    })

    const handleActivity = (): void => {
      service.notifyActivity()
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { capture: true, passive: true })
    }

    service.start()

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity, { capture: true })
      }

      unsubscribeExpired()
      service.stop()
    }
  }, [isUnlocked, service, onExpire])
}
