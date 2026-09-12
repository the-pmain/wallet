import { ACTIVITY_REQUEST_STATUS } from './request-status.ts'
import type {
  IActivityRequestDraftFields,
  IActivityRequestRecord,
  IActivityRequestsRepository,
  ICreateActivityRequestInput,
  IReviewActivityRequestInput,
} from './contracts.ts'

export class MemoryActivityRequestsRepository implements IActivityRequestsRepository {
  readonly #records: IActivityRequestRecord[] = []

  get records(): readonly IActivityRequestRecord[] {
    return this.#records
  }

  create(input: ICreateActivityRequestInput): Promise<IActivityRequestRecord> {
    const record: IActivityRequestRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date(),
      kind: input.kind,
      requestStatus: ACTIVITY_REQUEST_STATUS.Pending,
      requestedByName: input.requestedByName,
      reviewedAt: null,
      reviewedByName: null,
      reviewMessage: null,
      createdSendingId: null,
      createdReceivingId: null,
      userId: input.userId,
      transferStatus: input.transferStatus,
      failureMessage: input.failureMessage,
      recipientAddress: input.recipientAddress,
      amount: input.amount,
      symbol: input.symbol,
      usdAmount: input.usdAmount,
      assetChainId: input.assetChainId ?? null,
      assetStandard: input.assetStandard ?? null,
      assetAddress: input.assetAddress === undefined ? null : input.assetAddress,
      assetName: input.assetName ?? null,
      assetDecimals: input.assetDecimals ?? null,
      assetIsVerified: input.assetIsVerified ?? null,
    }

    this.#records.unshift(record)

    return Promise.resolve(record)
  }

  findById(id: string): Promise<IActivityRequestRecord | null> {
    return Promise.resolve(this.#records.find((entry) => entry.id === id) ?? null)
  }

  list(options?: { readonly limit?: number }): Promise<readonly IActivityRequestRecord[]> {
    const limit = options?.limit ?? 200
    const sorted = [...this.#records].sort((left, right) => {
      const leftPending = left.requestStatus === ACTIVITY_REQUEST_STATUS.Pending ? 0 : 1
      const rightPending = right.requestStatus === ACTIVITY_REQUEST_STATUS.Pending ? 0 : 1

      if (leftPending !== rightPending) {
        return leftPending - rightPending
      }

      return right.createdAt.getTime() - left.createdAt.getTime()
    })

    return Promise.resolve(sorted.slice(0, limit))
  }

  updateIfPending(
    id: string,
    patch: IActivityRequestDraftFields,
  ): Promise<IActivityRequestRecord | null> {
    const index = this.#records.findIndex((entry) => entry.id === id)

    if (index === -1) {
      return Promise.resolve(null)
    }

    const current = this.#records[index]

    if (
      current === undefined ||
      (current.requestStatus !== ACTIVITY_REQUEST_STATUS.Pending &&
        current.requestStatus !== ACTIVITY_REQUEST_STATUS.Approved)
    ) {
      return Promise.resolve(null)
    }

    const next: IActivityRequestRecord = {
      ...current,
      kind: patch.kind,
      requestStatus: ACTIVITY_REQUEST_STATUS.Pending,
      reviewedAt: null,
      reviewedByName: null,
      reviewMessage: null,
      transferStatus: patch.transferStatus,
      failureMessage: patch.failureMessage,
      recipientAddress: patch.recipientAddress,
      amount: patch.amount,
      symbol: patch.symbol,
      usdAmount: patch.usdAmount,
      assetChainId: patch.assetChainId ?? null,
      assetStandard: patch.assetStandard ?? null,
      assetAddress: patch.assetAddress === undefined ? null : patch.assetAddress,
      assetName: patch.assetName ?? null,
      assetDecimals: patch.assetDecimals ?? null,
      assetIsVerified: patch.assetIsVerified ?? null,
    }

    this.#records[index] = next

    return Promise.resolve(next)
  }

  reviewIfPending(
    id: string,
    patch: IReviewActivityRequestInput,
  ): Promise<IActivityRequestRecord | null> {
    const index = this.#records.findIndex((entry) => entry.id === id)

    if (index === -1) {
      return Promise.resolve(null)
    }

    const current = this.#records[index]

    if (current === undefined || current.requestStatus !== ACTIVITY_REQUEST_STATUS.Pending) {
      return Promise.resolve(null)
    }

    const next: IActivityRequestRecord = {
      ...current,
      requestStatus: patch.requestStatus,
      reviewedAt: patch.reviewedAt,
      reviewedByName: patch.reviewedByName,
      reviewMessage: patch.reviewMessage,
      createdSendingId: patch.createdSendingId,
      createdReceivingId: patch.createdReceivingId,
    }

    this.#records[index] = next

    return Promise.resolve(next)
  }
}