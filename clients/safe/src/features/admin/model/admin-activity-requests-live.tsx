import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'

import {
  activityRequestsSseUrl,
  parseActivityRequestSseEvent,
  type IActivityRequestSseEvent,
} from './activity-request-sse'

type ActivityRequestLiveListener = (event: IActivityRequestSseEvent) => void

const AdminActivityRequestsLiveContext = createContext<
  ((listener: ActivityRequestLiveListener) => () => void) | null
>(null)

/**
 * One cabinet stream per signed-in password.
 *
 * The request list and the toast queue share the connection.
 * Every signed-in cabinet password mounts this provider.
 */
export function AdminActivityRequestsLiveProvider({
  children,
  pass,
}: {
  readonly children: ReactNode
  readonly pass: string
}) {
  const listeners = useRef(new Set<ActivityRequestLiveListener>())

  useCabinetActivityRequestsStream(pass, (event) => {
    for (const listener of listeners.current) {
      listener(event)
    }
  })

  const subscribe = useRef((listener: ActivityRequestLiveListener) => {
    listeners.current.add(listener)

    return () => {
      listeners.current.delete(listener)
    }
  }).current

  return (
    <AdminActivityRequestsLiveContext.Provider value={subscribe}>
      {children}
    </AdminActivityRequestsLiveContext.Provider>
  )
}

export function useAdminActivityRequestsLive(onEvent: ActivityRequestLiveListener): void {
  const subscribe = useContext(AdminActivityRequestsLiveContext)
  const onEventRef = useRef(onEvent)

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (subscribe === null) {
      return
    }

    return subscribe((event) => {
      onEventRef.current(event)
    })
  }, [subscribe])
}

function useCabinetActivityRequestsStream(
  pass: string,
  onEvent: ActivityRequestLiveListener,
): void {
  const onEventRef = useRef(onEvent)

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    const configured = import.meta.env.VITE_SERVER_URL?.trim() ?? ''
    const url = activityRequestsSseUrl(configured)

    if (import.meta.env.MODE === 'test' && typeof EventSource !== 'undefined') {
      const source = new EventSource(url)
      const handle = (message: MessageEvent<string>) => {
        const parsed = parseActivityRequestSseEvent(message.data)

        if (parsed !== null) {
          onEventRef.current(parsed)
        }
      }

      source.addEventListener('activity-requests', handle as EventListener)

      return () => {
        source.removeEventListener('activity-requests', handle as EventListener)
        source.close()
      }
    }

    const controller = new AbortController()

    void readPinnedActivityRequestsStream(url, pass, controller.signal, (data) => {
      const parsed = parseActivityRequestSseEvent(data)

      if (parsed !== null) {
        onEventRef.current(parsed)
      }
    })

    return () => {
      controller.abort()
    }
  }, [pass])
}

async function readPinnedActivityRequestsStream(
  url: string,
  pass: string,
  signal: AbortSignal,
  onData: (data: string) => void,
): Promise<void> {
  const response = await fetch(url, {
    headers: {
      accept: 'text/event-stream',
      'x-admin-pass': pass,
    },
    signal,
  })

  if (!response.ok || response.body === null) {
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (!signal.aborted) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    buffer = emitSseBlocks(buffer, onData)
  }
}

function emitSseBlocks(buffer: string, onData: (data: string) => void): string {
  let rest = buffer

  while (true) {
    const split = rest.indexOf('\n\n')

    if (split === -1) {
      return rest
    }

    const block = rest.slice(0, split)
    rest = rest.slice(split + 2)
    let eventName = ''
    let data = ''

    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim()
      }

      if (line.startsWith('data:')) {
        data = line.slice(5).trim()
      }
    }

    if (eventName === 'activity-requests' && data !== '') {
      onData(data)
    }
  }
}
