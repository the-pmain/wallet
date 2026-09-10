import { EventBus, type EventListener } from '@/core/events'
import type { IClock } from '@/core/platform'
import type { Unsubscribe } from '@/core/types'

/**
 * Значение по умолчанию: пятнадцать минут бездействия.
 *
 * Компромисс между двумя видами вреда. Слишком короткий срок заставляет
 * вводить пароль посреди работы, и пользователь ставит самый длинный
 * из доступных либо отключает защиту вовсе. Слишком длинный оставляет
 * ключи в памяти разблокированного кошелька на брошенном устройстве.
 */
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000

/** Как часто проверяется истечение срока. */
const TICK_INTERVAL_MS = 5 * 1000

/** События автоблокировки. */
export interface AutoLockEventMap {
  /** Срок истёк, кошелёк подлежит блокировке. */
  'autolock:expired': Record<string, never>
}

/** Настройки сервиса. */
export interface IAutoLockOptions {
  /** Срок бездействия до блокировки. */
  readonly timeoutMs?: number
}

/** Зависимости сервиса. */
export interface IAutoLockDependencies {
  readonly clock: IClock
}

/**
 * Автоблокировка по бездействию.
 *
 * ЗАЧЕМ ОНА НУЖНА. Разблокированный кошелёк держит в памяти корневой
 * ключ, выведенный из seed-фразы. Пока сессия открыта, любой, кто
 * получил доступ к устройству, распоряжается средствами без пароля.
 * Автоблокировка ограничивает это окно временем, а не доверием
 * к обстановке вокруг.
 *
 * ЯДРО НЕ ЗНАЕТ О СОБЫТИЯХ БРАУЗЕРА. Сервис считает время и ничего
 * не слушает: нажатия клавиш и движения указателя отслеживает слой
 * приложения и сообщает о них через `notifyActivity`. Иначе ядро
 * перестало бы работать в service worker, где DOM отсутствует.
 *
 * СЕРВИС НЕ БЛОКИРУЕТ КОШЕЛЁК САМ. Он сообщает, что срок истёк;
 * блокировку выполняет тот, кто владеет сессией. Разделение нужно,
 * чтобы порядок закрытия — остановка опроса, разрыв соединений,
 * затирание ключа — оставался в одном месте.
 *
 * ИСКЛЮЧЕНИЙ ДЛЯ «ВАЖНЫХ ЭКРАНОВ» НЕТ. Оговорка «не блокировать, пока
 * открыта форма отправки» превратила бы защиту в необязательную:
 * достаточно оставить эту форму открытой.
 */
export class AutoLockService {
  readonly #clock: IClock
  readonly #events = new EventBus<AutoLockEventMap>()

  #timeoutMs: number

  #lastActivityAt = 0
  #stopTicking: Unsubscribe | null = null

  constructor(dependencies: IAutoLockDependencies, options: IAutoLockOptions = {}) {
    this.#clock = dependencies.clock
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  /** Действует ли отсчёт. */
  get isRunning(): boolean {
    return this.#stopTicking !== null
  }

  /** Текущий срок бездействия. */
  get timeoutMs(): number {
    return this.#timeoutMs
  }

  /**
   * Сколько осталось до блокировки.
   *
   * `null`, когда отсчёт не идёт: «не запущено» и «осталось ноль» —
   * разные состояния, и второе означает немедленную блокировку.
   */
  get remainingMs(): number | null {
    if (this.#stopTicking === null) {
      return null
    }

    return Math.max(0, this.#lastActivityAt + this.#timeoutMs - this.#clock.now())
  }

  /** Запускает отсчёт заново. Повторный вызов не создаёт второй таймер. */
  start(): void {
    this.stop()

    this.#lastActivityAt = this.#clock.now()

    this.#stopTicking = this.#clock.setInterval(() => {
      this.#tick()
    }, TICK_INTERVAL_MS)
  }

  /** Останавливает отсчёт. Вызывается при блокировке кошелька. */
  stop(): void {
    this.#stopTicking?.()
    this.#stopTicking = null
  }

  /**
   * Отмечает активность пользователя.
   *
   * Вызывается слоем приложения по событиям ввода.
   */
  notifyActivity(): void {
    if (this.#stopTicking === null) {
      return
    }

    this.#lastActivityAt = this.#clock.now()
  }

  /**
   * Меняет срок бездействия.
   *
   * Отсчёт начинается заново: применить новый срок к уже прошедшему
   * времени значило бы заблокировать кошелёк немедленно при выборе
   * более короткого значения.
   */
  setTimeout(timeoutMs: number): void {
    this.#timeoutMs = timeoutMs

    if (this.#stopTicking !== null) {
      this.start()
    }
  }

  on<TEvent extends keyof AutoLockEventMap>(
    event: TEvent,
    listener: EventListener<AutoLockEventMap[TEvent]>,
  ): Unsubscribe {
    return this.#events.on(event, listener)
  }

  /** Проверяет срок и сообщает о наступивших событиях. */
  #tick(): void {
    const remaining = this.remainingMs

    if (remaining === null) {
      return
    }

    if (remaining <= 0) {
      /* Отсчёт останавливается до сообщения о событии: обработчик
         блокирует кошелёк, и таймер, переживший блокировку, продолжил
         бы обращаться к уничтоженным сервисам. */
      this.stop()
      this.#events.emit('autolock:expired', {})
    }
  }
}
