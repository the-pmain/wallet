import { AutoLockService, type IClock } from '@/core'
import { useEffect, useMemo } from 'react'

/**
 * События браузера, считающиеся признаком присутствия пользователя.
 *
 * Движение указателя в список НЕ входит намеренно: курсор двигается
 * от случайного касания стола, и автоблокировка, продлеваемая этим,
 * не наступит никогда на брошенном ноутбуке.
 */
const ACTIVITY_EVENTS: readonly string[] = ['pointerdown', 'keydown', 'wheel', 'touchstart']

/** Параметры подключения автоблокировки. */
export interface IUseAutoLockParams {
  /** Отсчёт идёт только у разблокированного кошелька. */
  readonly isUnlocked: boolean

  readonly timeoutMs: number
  readonly clock: IClock

  /** Блокировка кошелька. Вызывается по истечении срока. */
  readonly onExpire: () => void
}

/**
 * Подключает автоблокировку к браузеру.
 *
 * ЯДРО СЧИТАЕТ ВРЕМЯ, ЭТОТ ХУК СЛУШАЕТ БРАУЗЕР. Разделение нужно, чтобы
 * `AutoLockService` оставался работоспособным в service worker, где нет
 * ни DOM, ни событий ввода.
 *
 * ПЕРЕХОД ВКЛАДКИ В ФОН СЧИТАЕТСЯ БЕЗДЕЙСТВИЕМ, А НЕ АКТИВНОСТЬЮ.
 * Обратное трактование продлевало бы сессию каждым переключением
 * окна — то есть ровно тогда, когда пользователь от кошелька отошёл.
 *
 * СОБЫТИЯ СЛУШАЮТСЯ В ФАЗЕ ПЕРЕХВАТА. Обработчик, остановивший
 * всплытие, иначе отменил бы продление сессии, и кошелёк блокировался
 * бы посреди работы.
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
