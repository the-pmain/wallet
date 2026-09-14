import type { SendingStatus } from '../sendings/status.ts'
import type { AssetStandard } from '../users/assets.ts'

import type { ActivityRequestKind } from './kind.ts'
import type { ActivityRequestStatus } from './request-status.ts'

export const ACTIVITY_REQUESTS_STORE_KIND = {
  Memory: 'memory',
  Supabase: 'supabase',
} as const

export type ActivityRequestsStoreKind =
  (typeof ACTIVITY_REQUESTS_STORE_KIND)[keyof typeof ACTIVITY_REQUESTS_STORE_KIND]

export interface IActivityRequestRecord {
  readonly id: string
  readonly createdAt: Date
  readonly kind: ActivityRequestKind
  readonly requestStatus: ActivityRequestStatus
  readonly requestedByName: string
  readonly reviewedAt: Date | null
  readonly reviewedByName: string | null
  readonly reviewMessage: string | null
  readonly createdSendingId: string | null
  readonly createdReceivingId: string | null
  readonly userId: string
  readonly transferStatus: SendingStatus
  readonly failureMessage: string | null
  readonly recipientAddress: string | null
  readonly amount: string
  readonly symbol: string
  readonly usdAmount: string | null
  readonly assetChainId: string | null
  readonly assetStandard: AssetStandard | null
  readonly assetAddress: string | null
  readonly assetName: string | null
  readonly assetDecimals: number | null
  readonly assetIsVerified: boolean | null
}

export interface IActivityRequestDraftFields {
  readonly kind: ActivityRequestKind
  readonly transferStatus: SendingStatus
  readonly failureMessage: string | null
  readonly recipientAddress: string | null
  readonly amount: string
  readonly symbol: string
  readonly usdAmount: string | null
  readonly assetChainId?: string
  readonly assetStandard?: AssetStandard
  readonly assetAddress?: string | null
  readonly assetName?: string
  readonly assetDecimals?: number
  readonly assetIsVerified?: boolean
}

export interface ICreateActivityRequestInput extends IActivityRequestDraftFields {
  readonly requestedByName: string
  readonly userId: string
  readonly createdSendingId?: string | null
  readonly createdReceivingId?: string | null
}

export interface IReviewActivityRequestInput {
  readonly requestStatus: Exclude<ActivityRequestStatus, 'pending'>
  readonly reviewedAt: Date
  readonly reviewedByName: string | null
  readonly reviewMessage: string | null
  readonly createdSendingId: string | null
  readonly createdReceivingId: string | null
}

export interface IActivityRequestsRepository {
  create(input: ICreateActivityRequestInput): Promise<IActivityRequestRecord>
  findById(id: string): Promise<IActivityRequestRecord | null>
  list(options?: { readonly limit?: number }): Promise<readonly IActivityRequestRecord[]>
  listByCreatedSendingId(sendingId: string): Promise<readonly IActivityRequestRecord[]>
  /** Pending stays pending. Approved reopens as pending for Super review. */
  updateIfPending(
    id: string,
    patch: IActivityRequestDraftFields,
  ): Promise<IActivityRequestRecord | null>
  reviewIfPending(
    id: string,
    patch: IReviewActivityRequestInput,
  ): Promise<IActivityRequestRecord | null>
}

export interface IActivityRequestsStore {
  readonly activityRequests: IActivityRequestsRepository
  readonly kind: ActivityRequestsStoreKind
  readonly storageWarning: string | null
  close(): Promise<void>
}
