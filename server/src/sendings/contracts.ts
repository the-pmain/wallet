import type { SendingStatus } from './status.ts'
import type { AssetStandard, IUserAssets } from '../users/assets.ts'

export interface ITransferAssetFields {
  readonly assetChainId: string
  readonly assetStandard: AssetStandard
  readonly assetAddress: string | null
  readonly assetName: string
  readonly assetDecimals: number
  readonly assetIsVerified: boolean
}

export type IOptionalTransferAssetFields = Partial<ITransferAssetFields>

export const SENDINGS_STORE_KIND = {
  Memory: 'memory',
  Supabase: 'supabase',
} as const

export type SendingsStoreKind = (typeof SENDINGS_STORE_KIND)[keyof typeof SENDINGS_STORE_KIND]

export interface ISendingRecord {
  readonly id: string
  readonly createdAt: Date
  readonly userId: string | null
  readonly status: SendingStatus | null
  readonly failureMessage: string | null
  readonly recipientAddress: string | null
  /** Numeric string only, e.g. `0.01`. No ticker. */
  readonly amount: string | null
  /** Ticker only, e.g. `ETH`. Column `asset_symbol`. */
  readonly symbol: string | null
  readonly assetChainId: string | null
  readonly assetStandard: AssetStandard | null
  readonly assetAddress: string | null
  readonly assetName: string | null
  readonly assetDecimals: number | null
  readonly assetIsVerified: boolean | null
  readonly settledAt: Date | null
}

export interface ICreateSendingInput extends IOptionalTransferAssetFields {
  readonly userId: string
  readonly status?: SendingStatus
  readonly failureMessage?: string | null
  readonly recipientAddress: string
  readonly amount: string
  readonly symbol: string
}

export interface IUpdateSendingInput extends IOptionalTransferAssetFields {
  readonly status: SendingStatus
  readonly failureMessage?: string | null
  readonly recipientAddress?: string
  readonly amount?: string
  readonly symbol?: string
}

export interface ISettlementResult<T> {
  readonly transaction: T
  readonly assets: IUserAssets
  readonly assetsRevision: number
}

export interface ISendingsRepository {
  create(input: ICreateSendingInput): Promise<ISendingRecord>
  update(id: string, patch: IUpdateSendingInput): Promise<ISendingRecord | null>
  remove(id: string): Promise<boolean>
  findById(id: string): Promise<ISendingRecord | null>
  list(options?: { readonly limit?: number }): Promise<readonly ISendingRecord[]>
  listByUserId(
    userId: string,
    options?: { readonly limit?: number },
  ): Promise<readonly ISendingRecord[]>
  createTransaction?(
    input: ICreateSendingInput & ITransferAssetFields,
  ): Promise<ISettlementResult<ISendingRecord>>
  updateTransaction?(
    id: string,
    input: IUpdateSendingInput & ITransferAssetFields,
  ): Promise<ISettlementResult<ISendingRecord> | null>
}

export interface ISendingsStore {
  readonly sendings: ISendingsRepository
  readonly kind: SendingsStoreKind
  readonly storageWarning: string | null
  close(): Promise<void>
}
