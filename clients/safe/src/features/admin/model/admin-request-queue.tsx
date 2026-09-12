import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'

import { AdminAuthError } from './AdminClient'
import { useAdminSession } from './admin-context'
import { useAdminActivityRequestsLive } from './admin-activity-requests-live'
import type { IAdminDirectoryActivityRequest } from './admin-page'
import {
  applyLiveRequestEvent,
  dismissedRequestKey,
  hydrateRequestQueue,
  isOperatorDecisionToast,
  type IRequestToastItem,
} from './admin-request-toasts'

const REQUEST_TOAST_PAGE_SIZE = 100

interface IAdminRequestQueue {
  readonly queue: readonly IRequestToastItem[]
  readonly setQueue: Dispatch<SetStateAction<readonly IRequestToastItem[]>>
  readonly dismiss: (id: string, requestStatus: IAdminDirectoryActivityRequest['requestStatus']) => void
}

const AdminRequestQueueContext = createContext<IAdminRequestQueue | null>(null)

/**
 * Toast queue for cabinet activity requests.
 *
 * Super hydrates pending drafts that arrived while the cabinet was
 * closed. Regular admin skips hydrate and only queues Super's
 * approve or reject of drafts in their name.
 */
export function AdminRequestQueueProvider({ children }: { readonly children: ReactNode }) {
  const { client, lock, canWrite, operatorName } = useAdminSession()
  const [queue, setQueue] = useState<readonly IRequestToastItem[]>([])
  const dismissed = useRef(new Set<string>())
  const hydrated = useRef(false)
  const decisionsOnly = !canWrite

  const dismiss = useCallback(
    (id: string, requestStatus: IAdminDirectoryActivityRequest['requestStatus']) => {
      dismissed.current.add(dismissedRequestKey(id, requestStatus))
      setQueue((current) => current.filter((item) => item.id !== id))
    },
    [],
  )

  useEffect(() => {
    if (hydrated.current) {
      return
    }

    if (decisionsOnly) {
      hydrated.current = true

      return
    }

    let cancelled = false

    void client
      .listDirectoryActivityRequests({
        page: 1,
        pageSize: REQUEST_TOAST_PAGE_SIZE,
        q: '',
        status: 'pending',
      })
      .then((page) => {
        if (!cancelled) {
          hydrated.current = true
          setQueue((current) => hydrateRequestQueue(current, page.items, dismissed.current))
        }
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return
        }

        if (caught instanceof AdminAuthError && caught.status === 401) {
          lock()
        }
      })

    return () => {
      cancelled = true
    }
  }, [client, decisionsOnly, lock])

  useAdminActivityRequestsLive((event) => {
    if (decisionsOnly && !isOperatorDecisionToast(event, operatorName)) {
      return
    }

    if (event.type_request === 'update' && event.requestStatus === 'pending') {
      dismissed.current.delete(dismissedRequestKey(event.id, event.requestStatus))
    }

    setQueue((current) => applyLiveRequestEvent(current, event, dismissed.current))
  })

  const value = useMemo(
    () => ({
      queue,
      setQueue,
      dismiss,
    }),
    [dismiss, queue],
  )

  return (
    <AdminRequestQueueContext.Provider value={value}>{children}</AdminRequestQueueContext.Provider>
  )
}

export function useAdminRequestQueue(): IAdminRequestQueue {
  const queue = useContext(AdminRequestQueueContext)

  if (queue === null) {
    throw new Error('useAdminRequestQueue must be called inside AdminRequestQueueProvider.')
  }

  return queue
}
