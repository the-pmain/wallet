import type { IActivityRequestSseEvent } from '../api/contracts.ts'

type ActivityRequestsListener = (event: IActivityRequestSseEvent) => void

/**
 * Live subscribers of the `activity-requests` stream.
 *
 * The cabinet opens `GET /v1/admin/activity-requests/stream` with any
 * PIN. There is no user-scoped filter: requests are a shared queue.
 */
export class ActivityRequestsHub {
  readonly #listeners = new Set<ActivityRequestsListener>()

  subscribe(send: ActivityRequestsListener): () => void {
    this.#listeners.add(send)

    return () => {
      this.#listeners.delete(send)
    }
  }

  publish(event: IActivityRequestSseEvent): void {
    for (const send of this.#listeners) {
      send(event)
    }
  }

  get size(): number {
    return this.#listeners.size
  }
}

export function formatActivityRequestsSseFrame(event: IActivityRequestSseEvent): string {
  return `event: activity-requests\ndata: ${JSON.stringify(event)}\n\n`
}
