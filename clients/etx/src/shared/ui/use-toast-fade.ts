import { useCallback, useEffect, useRef, useState } from 'react'

/** Выход быстрее входа: карточка не должна «висеть» после закрытия. */
export const TOAST_FADE_MS = 150

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/**
 * Сначала гасит карточку, потом снимает её из очереди.
 *
 * Без паузы `animate-out` не успевает проиграться: React удаляет узел
 * в том же кадре, что и нажатие.
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
