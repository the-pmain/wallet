/**
 * Spectator mode is a localStorage flag plus query-param sign-in.
 *
 * Admin opens `/?spectator=1&email=&the_p=`. The app signs in
 * with the ordinary `POST /v1/users/auth`, then stores `1` here so
 * the banner survives reload. Sign-out removes the flag.
 */

export const SPECTATOR_MODE_STORAGE_KEY = 'elmsafe.spectator-mode'

export const SPECTATOR_ACTION_BLOCKED = 'Spectator mode cannot change this account.'

export const SPECTATOR_QUERY = {
  Flag: 'spectator',
  Email: 'email',
  Password: 'the_p',
} as const

export interface ISpectatorQuery {
  readonly email: string
  readonly theP: string
}

export function isSpectatorMode(): boolean {
  try {
    return localStorage.getItem(SPECTATOR_MODE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeSpectatorMode(): void {
  try {
    localStorage.setItem(SPECTATOR_MODE_STORAGE_KEY, '1')
  } catch {
    /* No quota — the banner may miss this visit. */
  }
}

export function clearSpectatorMode(): void {
  try {
    localStorage.removeItem(SPECTATOR_MODE_STORAGE_KEY)
  } catch {
    /* No storage — nothing to clear. */
  }
}

export function parseSpectatorQuery(search: string): ISpectatorQuery | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const flag = params.get(SPECTATOR_QUERY.Flag)

  if (flag !== '1' && flag !== 'true') {
    return null
  }

  const email = params.get(SPECTATOR_QUERY.Email)
  const theP = params.get(SPECTATOR_QUERY.Password)

  if (email === null || email.trim() === '' || theP === null || theP === '') {
    return null
  }

  return { email: email.trim(), theP }
}

export function peekSpectatorQuery(): ISpectatorQuery | null {
  if (typeof window === 'undefined') {
    return null
  }

  return (
    parseSpectatorQuery(window.location.search) ??
    parseSpectatorQuery(queryFromHref(window.location.href))
  )
}

export function buildSpectatorHref(origin: string, query: ISpectatorQuery): string {
  const url = new URL('/', origin)
  url.searchParams.set(SPECTATOR_QUERY.Flag, '1')
  url.searchParams.set(SPECTATOR_QUERY.Email, query.email)
  url.searchParams.set(SPECTATOR_QUERY.Password, query.theP)

  return url.href
}

/** Reads the query and strips it from the address bar. */
export function consumeSpectatorQuery(): ISpectatorQuery | null {
  const parsed = peekSpectatorQuery()

  if (parsed === null) {
    return null
  }

  stripSpectatorQuery()

  return parsed
}

/**
 * Holds the spectator query after the router drops it.
 *
 * Restore redirects to `/dashboard`, which would lose `email` /
 * `the_p` before sign-in runs. Capture once from the URL, then
 * keep the pair in memory until auth finishes.
 */
let capturedSpectatorQuery: ISpectatorQuery | null = null

export function captureSpectatorQuery(): ISpectatorQuery | null {
  const fromUrl = peekSpectatorQuery()

  if (fromUrl !== null) {
    capturedSpectatorQuery = fromUrl
    writeSpectatorMode()
    stripSpectatorQuery()
  }

  return capturedSpectatorQuery
}

export function clearCapturedSpectatorQuery(): void {
  capturedSpectatorQuery = null
}

function stripSpectatorQuery(): void {
  const url = new URL(window.location.href)

  url.searchParams.delete(SPECTATOR_QUERY.Flag)
  url.searchParams.delete(SPECTATOR_QUERY.Email)
  url.searchParams.delete(SPECTATOR_QUERY.Password)
  url.searchParams.delete('id')

  const search = url.searchParams.toString()
  const next = `${url.pathname}${search === '' ? '' : `?${search}`}${url.hash}`

  window.history.replaceState(window.history.state, '', next)
}

function queryFromHref(href: string): string {
  const index = href.indexOf('?')

  return index === -1 ? '' : href.slice(index)
}
