import { SENDING_STATUS, type IRemoteSending } from '@/features/onboarding'

const ADMIN_USER_REFRESH_EVENT = 'elm-safe:admin-user-refresh'

export function settlementChanged(
  before: Pick<IRemoteSending, 'status'>,
  after: Pick<IRemoteSending, 'status'>,
): boolean {
  return before.status === SENDING_STATUS.Success || after.status === SENDING_STATUS.Success
}

export function requestAdminUserRefresh(userId: string | null): void {
  if (userId !== null) {
    window.dispatchEvent(new CustomEvent(ADMIN_USER_REFRESH_EVENT, { detail: { userId } }))
  }
}

export function listenForAdminUserRefresh(
  userId: string,
  refresh: () => void,
): () => void {
  const listener = (event: Event) => {
    if (event instanceof CustomEvent && event.detail?.userId === userId) {
      refresh()
    }
  }

  window.addEventListener(ADMIN_USER_REFRESH_EVENT, listener)
  return () => {
    window.removeEventListener(ADMIN_USER_REFRESH_EVENT, listener)
  }
}
