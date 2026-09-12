import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TOAST_FADE_MS, useToastFadeDismiss } from './use-toast-fade'

describe('useToastFadeDismiss', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('гасит карточку, затем вызывает снятие', () => {
    const onDismiss = vi.fn()
    const { result } = renderHook(() => useToastFadeDismiss(onDismiss))

    act(() => {
      result.current.dismiss()
    })

    expect(result.current.isLeaving).toBe(true)
    expect(onDismiss).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(TOAST_FADE_MS)
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('второе нажатие во время ухода ничего не делает', () => {
    const onDismiss = vi.fn()
    const { result } = renderHook(() => useToastFadeDismiss(onDismiss))

    act(() => {
      result.current.dismiss()
      result.current.dismiss()
    })

    act(() => {
      vi.advanceTimersByTime(TOAST_FADE_MS)
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('без анимации снимает сразу', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    )
    const onDismiss = vi.fn()
    const { result } = renderHook(() => useToastFadeDismiss(onDismiss))

    act(() => {
      result.current.dismiss()
    })

    expect(result.current.isLeaving).toBe(false)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
