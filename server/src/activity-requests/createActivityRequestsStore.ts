import type { IServerConfig } from '../config.ts'

import { ACTIVITY_REQUESTS_STORE_KIND, type IActivityRequestsStore } from './contracts.ts'
import { MemoryActivityRequestsRepository } from './MemoryActivityRequestsRepository.ts'
import {
  ActivityRequestsDatabaseError,
  SupabaseRestActivityRequestsRepository,
} from './SupabaseRestActivityRequestsRepository.ts'

const MISSING_TABLE_WARNING =
  'Supabase table public.activity_requests is missing. In Supabase → SQL Editor, run server/supabase/activity-requests.sql, then restart the server. Using in-memory activity request storage until then.'

/**
 * Builds the activity-requests store.
 *
 * With `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — writes go to
 * `public.activity_requests` via the REST service-role client (bypasses
 * RLS) after the Node check. Otherwise the queue lives in process memory.
 */
export async function createActivityRequestsStore(
  config: IServerConfig,
): Promise<IActivityRequestsStore> {
  if (config.supabaseUrl !== null && config.supabaseServiceRoleKey === null) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required when SUPABASE_URL is set. ' +
        'public.activity_requests is read and written only by the Node server after ' +
        'application authentication. The service-role key stays on the server.',
    )
  }

  if (config.supabaseUrl === null || config.supabaseServiceRoleKey === null) {
    return memoryStore(null)
  }

  const primary = new SupabaseRestActivityRequestsRepository({
    supabaseUrl: config.supabaseUrl,
    serviceRoleKey: config.supabaseServiceRoleKey,
  })

  try {
    await primary.list({ limit: 1 })
  } catch (error) {
    if (error instanceof ActivityRequestsDatabaseError && error.isMissingTable) {
      console.warn(MISSING_TABLE_WARNING)
      return memoryStore(MISSING_TABLE_WARNING)
    }

    console.warn('Supabase activity requests probe failed. Using in-memory storage.')
    return memoryStore(
      'Supabase activity requests are unavailable. Requests are stored in memory until the server restarts.',
    )
  }

  return {
    activityRequests: primary,
    kind: ACTIVITY_REQUESTS_STORE_KIND.Supabase,
    storageWarning: null,
    close: () => Promise.resolve(),
  }
}

function memoryStore(storageWarning: string | null): IActivityRequestsStore {
  return {
    activityRequests: new MemoryActivityRequestsRepository(),
    kind: ACTIVITY_REQUESTS_STORE_KIND.Memory,
    storageWarning,
    close: () => Promise.resolve(),
  }
}
