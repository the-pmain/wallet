/**
 * Ярлык на домашний экран.
 *
 * Android Chrome, Edge и Samsung присылают `beforeinstallprompt`.
 * Если поймать событие, кнопка откроет системный диалог установки.
 * На iPhone и iPad такого события нет: Apple не даёт сайту поставить
 * иконку самому, поэтому кнопка показывает шаги через меню Share.
 *
 * СЛУШАТЕЛЬ СТОИТ НА ВСЁ ПРИЛОЖЕНИЕ. Событие приходит один раз и
 * рано. Если ловить его только на экране настроек, диалог чаще
 * всего уже будет потерян.
 */

const WORKER_SCRIPT = '/sw.js'
const WORKER_POLICY = 'home-screen-worker'

export interface IBeforeInstallPromptEvent extends Event {
  readonly prompt: () => Promise<void>
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>
}

export type HomeScreenPromptResult = 'accepted' | 'dismissed' | 'unavailable'

type HomeScreenListener = () => void

let deferredPrompt: IBeforeInstallPromptEvent | null = null
let installedThisSession = false
let listening = false
const listeners = new Set<HomeScreenListener>()
let workerPolicy:
  | { readonly createScriptURL: (input: string) => unknown }
  | undefined

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

function onBeforeInstallPrompt(event: Event): void {
  event.preventDefault()
  deferredPrompt = event as IBeforeInstallPromptEvent
  notify()
}

function onAppInstalled(): void {
  deferredPrompt = null
  installedThisSession = true
  notify()
}

export function startHomeScreenInstallListener(): void {
  if (listening || typeof window === 'undefined') {
    return
  }

  listening = true
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.addEventListener('appinstalled', onAppInstalled)
}

export function subscribeHomeScreenInstall(listener: HomeScreenListener): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function getDeferredInstallPrompt(): IBeforeInstallPromptEvent | null {
  return deferredPrompt
}

export function isHomeScreenInstalled(
  view: Pick<Window, 'matchMedia'> & { readonly navigator: Navigator } = window,
): boolean {
  return installedThisSession || isStandaloneDisplay(view)
}

export function isStandaloneDisplay(
  view: Pick<Window, 'matchMedia'> & { readonly navigator: Navigator } = window,
): boolean {
  if (view.matchMedia('(display-mode: standalone)').matches) {
    return true
  }

  return (
    'standalone' in view.navigator &&
    (view.navigator as Navigator & { readonly standalone?: boolean }).standalone === true
  )
}

export function isIosDevice(
  agent: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> = navigator,
): boolean {
  if (/iPad|iPhone|iPod/u.test(agent.userAgent)) {
    return true
  }

  /* iPadOS 13+ представляется Macintosh с сенсорным экраном. */
  return agent.platform === 'MacIntel' && agent.maxTouchPoints > 1
}

export async function promptHomeScreenInstall(): Promise<HomeScreenPromptResult> {
  const event = deferredPrompt

  if (event === null) {
    return 'unavailable'
  }

  deferredPrompt = null
  notify()
  await event.prompt()
  const { outcome } = await event.userChoice

  if (outcome === 'accepted') {
    installedThisSession = true
    notify()
  }

  return outcome
}

/**
 * Регистрирует сетевой воркер, без которого Chrome не предложит
 * ярлык на домашний экран.
 *
 * ТОЛЬКО В БОЕВОЙ СБОРКЕ. Воркер на dev-сервере Vite мешает HMR
 * и остаётся после закрытия вкладки. Кнопка в разработке всё равно
 * работает: открывает диалог с шагами.
 *
 * TRUSTED TYPES. `require-trusted-types-for 'script'` заставляет
 * `serviceWorker.register` отказаться от обычной строки. Политика
 * принимает только `/sw.js`.
 */
export function registerHomeScreenWorker(): void {
  if (!import.meta.env.PROD) {
    return
  }

  if (!('serviceWorker' in navigator)) {
    return
  }

  void navigator.serviceWorker.register(workerScriptUrl() as string)
}

function workerScriptUrl(): string | unknown {
  const trustedTypes = (
    globalThis as {
      trustedTypes?: {
        createPolicy: (
          name: string,
          rules: { readonly createScriptURL: (input: string) => string },
        ) => { readonly createScriptURL: (input: string) => unknown }
      }
    }
  ).trustedTypes

  if (trustedTypes === undefined) {
    return WORKER_SCRIPT
  }

  workerPolicy ??= trustedTypes.createPolicy(WORKER_POLICY, {
    createScriptURL(input: string) {
      if (input === WORKER_SCRIPT) {
        return input
      }

      throw new TypeError(`Refused to create a script URL from ${input}`)
    },
  })

  return workerPolicy.createScriptURL(WORKER_SCRIPT)
}

/** Сбрасывает пойманный prompt между тестами. */
export function resetHomeScreenInstall(): void {
  if (typeof window !== 'undefined' && listening) {
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.removeEventListener('appinstalled', onAppInstalled)
  }

  deferredPrompt = null
  installedThisSession = false
  listening = false
  listeners.clear()
}
