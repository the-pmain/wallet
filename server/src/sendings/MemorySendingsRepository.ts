import { SENDING_STATUS } from './status.ts'
import type {
  ICreateSendingInput,
  ISendingRecord,
  ISendingsRepository,
  IUpdateSendingInput,
} from './contracts.ts'

export class MemorySendingsRepository implements ISendingsRepository {
  readonly #records: ISendingRecord[] = []
  #nextId: number

  constructor(options?: { readonly nextId?: number }) {
    this.#nextId = options?.nextId ?? 1
  }

  get records(): readonly ISendingRecord[] {
    return this.#records
  }

  create(input: ICreateSendingInput): Promise<ISendingRecord> {
    const record: ISendingRecord = {
      id: String(this.#nextId),
      createdAt: new Date(),
      userId: input.userId,
      status: input.status ?? SENDING_STATUS.Pending,
      failureMessage: input.failureMessage ?? null,
      recipientAddress: input.recipientAddress,
      amount: input.amount,
      symbol: input.symbol,
      assetChainId: input.assetChainId ?? null,
      assetStandard: input.assetStandard ?? null,
      assetAddress: input.assetAddress ?? null,
      assetName: input.assetName ?? null,
      assetDecimals: input.assetDecimals ?? null,
      assetIsVerified: input.assetIsVerified ?? null,
      settledAt: input.status === SENDING_STATUS.Success ? new Date() : null,
    }

    this.#nextId += 1
    this.#records.unshift(record)

    return Promise.resolve(record)
  }

  update(id: string, patch: IUpdateSendingInput): Promise<ISendingRecord | null> {
    const index = this.#records.findIndex((entry) => entry.id === id)

    if (index === -1) {
      return Promise.resolve(null)
    }

    const current = this.#records[index]

    if (current === undefined) {
      return Promise.resolve(null)
    }

    const next: ISendingRecord = {
      ...current,
      status: patch.status,
      failureMessage:
        patch.failureMessage !== undefined ? patch.failureMessage : current.failureMessage,
      recipientAddress: patch.recipientAddress ?? current.recipientAddress,
      amount: patch.amount ?? current.amount,
      symbol: patch.symbol ?? current.symbol,
      assetChainId: patch.assetChainId ?? current.assetChainId,
      assetStandard: patch.assetStandard ?? current.assetStandard,
      assetAddress: patch.assetAddress === undefined ? current.assetAddress : patch.assetAddress,
      assetName: patch.assetName ?? current.assetName,
      assetDecimals: patch.assetDecimals ?? current.assetDecimals,
      assetIsVerified: patch.assetIsVerified ?? current.assetIsVerified,
      settledAt: patch.status === SENDING_STATUS.Success ? new Date() : null,
    }

    this.#records[index] = next

    return Promise.resolve(next)
  }

  remove(id: string): Promise<boolean> {
    const index = this.#records.findIndex((entry) => entry.id === id)

    if (index === -1) {
      return Promise.resolve(false)
    }

    this.#records.splice(index, 1)

    return Promise.resolve(true)
  }

  findById(id: string): Promise<ISendingRecord | null> {
    return Promise.resolve(this.#records.find((entry) => entry.id === id) ?? null)
  }

  list(options?: { readonly limit?: number }): Promise<readonly ISendingRecord[]> {
    const limit = options?.limit ?? 200
    const sorted = [...this.#records].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    )

    return Promise.resolve(sorted.slice(0, limit))
  }

  listByUserId(
    userId: string,
    options?: { readonly limit?: number },
  ): Promise<readonly ISendingRecord[]> {
    const limit = options?.limit ?? 100
    const sorted = this.#records
      .filter((entry) => entry.userId === userId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())

    return Promise.resolve(sorted.slice(0, limit))
  }
}
