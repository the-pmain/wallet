import { useCallback, useEffect, useRef, useState } from 'react'

/** Exit is faster than enter: the card must not linger after close. */
export const TOAST_FADE_MS = 150

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/**
 * Fades the card out, then removes it from the queue.
 *
 * Without the pause, `animate-out` never plays: React unmounts the
 * node in the same frame as the click.
 */
export function useToastFadeDismiss(onDismiss: () => void): {
  readonly isLeaving: boolean
  readonly dismiss: () => void
} {
  const [isLeaving, setLeaving] = useState(false)
  const onDismissRef = useRef(onDismiss)
  const started = useRef(false)

  onDismissRef.current = onDismiss

  useEffect(() => {
    if (!isLeaving) {
      return
    }

    const timer = window.setTimeout(() => {
      onDismissRef.current()
    }, TOAST_FADE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [isLeaving])

  const dismiss = useCallback(() => {
    if (started.current) {
      return
    }

    started.current = true

    if (prefersReducedMotion()) {
      onDismissRef.current()

      return
    }

    setLeaving(true)
  }, [])

  return { isLeaving, dismiss }
}
