/**
 * Home-screen shortcut.
 *
 * Android Chrome, Edge, and Samsung fire `beforeinstallprompt`.
 * Capturing it lets a button open the system install dialog. iPhone
 * and iPad have no such event: Apple does not let a site place the
 * icon itself, so the button shows Share-menu steps instead.
 *
 * THE LISTENER IS PROCESS-WIDE. The event arrives once, early. If
 * only Settings listened, the prompt would often already be gone.
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

  /* iPadOS 13+ reports itself as a Macintosh with a touch screen. */
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
 * Registers the network-only worker that Chrome requires before it
 * will offer a home-screen shortcut.
 *
 * PRODUCTION ONLY. A worker on the Vite dev server fights HMR and
 * stays after the tab is closed. The install button still works in
 * development: it opens the instruction dialog.
 *
 * TRUSTED TYPES. `require-trusted-types-for 'script'` makes
 * `serviceWorker.register` refuse a raw string. The policy accepts
 * only `/sw.js`.
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

/** Clears captured prompt state between tests. */
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
