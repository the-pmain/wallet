import type { IUsersRepository } from '../users/contracts.ts'
import {
  applyAssetContribution,
  AssetSettlementError,
  exactDecimalToUnits,
  resolveAssetMetadata,
} from '../users/asset-settlement.ts'
import type { IAssetMetadata, IAssetToken, IUserAssets } from '../users/assets.ts'
import { readSendingAmount } from '../sendings/amount.ts'
import { isSendingStatus, SENDING_STATUS, type SendingStatus } from '../sendings/status.ts'
import { readSendingSymbol } from '../sendings/symbol.ts'

import type { IReceivingRecord, IReceivingsRepository } from './contracts.ts'
import type { ITransferAssetFields } from '../sendings/contracts.ts'

interface IAssetMetadataInput {
  readonly assetChainId?: string
  readonly assetStandard?: 'native' | 'ERC-20'
  readonly assetAddress?: string | null
  readonly assetName?: string
  readonly assetDecimals?: number
  readonly assetIsVerified?: boolean
}

export interface IRegisterReceivingInput extends IAssetMetadataInput {
  readonly userId: string
  readonly status?: SendingStatus
  readonly failureMessage?: string | null
  readonly recipientAddress?: string | null
  readonly amount: string
  readonly symbol: string
  readonly usdAmount?: string | null
}

export class ReceivingsService {
  readonly #receivings: IReceivingsRepository
  readonly #users: IUsersRepository

  constructor(receivings: IReceivingsRepository, users: IUsersRepository) {
    this.#receivings = receivings
    this.#users = users
  }

  async register(input: IRegisterReceivingInput): Promise<IReceivingRecord> {
    const fields = readReceivingFields(input)
    const user = await this.#users.findById(input.userId.trim())

    if (user === null) {
      throw new ReceivingsValidationError('User for this receiving was not found.')
    }

    const status = input.status ?? SENDING_STATUS.Pending

    const metadata = requireMetadata(user.assets.tokens, fields.symbol, input)
    const createInput = {
      userId: user.id,
      status,
      failureMessage: emptyToNull(input.failureMessage ?? null),
      recipientAddress: emptyToNull(input.recipientAddress ?? null),
      amount: fields.amount,
      symbol: fields.symbol,
      usdAmount: emptyToNull(input.usdAmount ?? null),
      ...toAssetFields(metadata),
    }

    if (this.#receivings.createTransaction !== undefined) {
      return (await this.#receivings.createTransaction(createInput)).transaction
    }

    return await this.#createInMemory(user.id, user.assets, createInput)
  }

  async list(options?: { readonly limit?: number }): Promise<readonly IReceivingRecord[]> {
    return await this.#receivings.list(options)
  }

  async findById(id: string): Promise<IReceivingRecord | null> {
    return await this.#receivings.findById(id)
  }

  async listByUserId(userId: string): Promise<readonly IReceivingRecord[]> {
    const id = userId.trim()

    return ownedByUser(await this.#receivings.listByUserId(id), id)
  }

  async listForUser(input: {
    readonly userId: string
    readonly email: string
    readonly theP: string
  }): Promise<readonly IReceivingRecord[]> {
    const user = await this.#users.findByCredentials({
      email: input.email,
      theP: input.theP,
    })

    if (user === null || user.id !== input.userId.trim()) {
      throw new ReceivingsAuthError('Invalid credentials.')
    }

    /* Only `public.receivings` rows whose `user_id` is this owner. */
    return await this.listByUserId(user.id)
  }

  async update(id: string, patch: IUpdateReceivingFields): Promise<IReceivingRecord | null> {
    const fields = readReceivingFields(patch)

    if (!isSendingStatus(patch.status)) {
      throw new ReceivingsValidationError('Status is required.')
    }

    const current = await this.#receivings.findById(id)

    if (current === null) {
      return null
    }

    if (current.userId === null) {
      throw new ReceivingsValidationError('User for this receiving was not found.')
    }

    const user = await this.#users.findById(current.userId)
    if (user === null) {
      throw new ReceivingsValidationError('User for this receiving was not found.')
    }
    const metadata = requireMetadata(user.assets.tokens, fields.symbol, patch)
    const updateInput = {
      status: patch.status,
      failureMessage: emptyToNull(patch.failureMessage),
      recipientAddress: emptyToNull(patch.recipientAddress ?? null),
      amount: fields.amount,
      symbol: fields.symbol,
      usdAmount: emptyToNull(patch.usdAmount ?? null),
      ...toAssetFields(metadata),
    }

    if (this.#receivings.updateTransaction !== undefined) {
      return (await this.#receivings.updateTransaction(id, updateInput))?.transaction ?? null
    }

    let assets = user.assets
    try {
      if (current.status === SENDING_STATUS.Success) {
        const oldMetadata = requireRecordMetadata(user.assets.tokens, current)
        assets = applyAssetContribution(
          assets,
          current.symbol ?? fields.symbol,
          oldMetadata,
          -exactDecimalToUnits(current.amount ?? '0', oldMetadata.decimals),
          { allowAppend: false },
        )
      }
      if (patch.status === SENDING_STATUS.Success) {
        assets = applyAssetContribution(
          assets,
          fields.symbol,
          metadata,
          exactDecimalToUnits(fields.amount, metadata.decimals),
          { allowAppend: true },
        )
      }
    } catch (error) {
      throw settlementValidation(error)
    }

    await this.#users.update(user.id, { assets })
    try {
      return await this.#receivings.update(id, updateInput)
    } catch (error) {
      await this.#users.update(user.id, { assets: user.assets })
      throw error
    }
  }

  async remove(id: string): Promise<IReceivingRecord | null> {
    const current = await this.#receivings.findById(id)

    if (current === null) {
      return null
    }

    if (current.status !== SENDING_STATUS.Success) {
      const removed = await this.#receivings.remove(id)

      return removed ? current : null
    }

    if (current.userId === null) {
      throw new ReceivingsValidationError('User for this receiving was not found.')
    }

    const user = await this.#users.findById(current.userId)

    if (user === null) {
      throw new ReceivingsValidationError('User for this receiving was not found.')
    }

    let assets = user.assets

    try {
      const metadata = requireRecordMetadata(user.assets.tokens, current)
      assets = applyAssetContribution(
        assets,
        current.symbol ?? '',
        metadata,
        -exactDecimalToUnits(current.amount ?? '0', metadata.decimals),
        { allowAppend: false },
      )
    } catch (error) {
      throw settlementValidation(error)
    }

    await this.#users.update(user.id, { assets })

    try {
      const removed = await this.#receivings.remove(id)

      if (!removed) {
        await this.#users.update(user.id, { assets: user.assets })

        return null
      }

      return current
    } catch (error) {
      await this.#users.update(user.id, { assets: user.assets })
      throw error
    }
  }

  async #createInMemory(
    userId: string,
    originalAssets: IUserAssets,
    input: Parameters<IReceivingsRepository['create']>[0] & ITransferAssetFields,
  ): Promise<IReceivingRecord> {
    if (input.status === SENDING_STATUS.Success) {
      try {
        const next = applyAssetContribution(
          originalAssets,
          input.symbol,
          fromAssetFields(input),
          exactDecimalToUnits(input.amount, input.assetDecimals),
          { allowAppend: true },
        )
        await this.#users.update(userId, { assets: next })
      } catch (error) {
        throw settlementValidation(error)
      }
    }

    try {
      return await this.#receivings.create(input)
    } catch (error) {
      await this.#users.update(userId, { assets: originalAssets })
      throw error
    }
  }
}

export interface IUpdateReceivingFields extends IAssetMetadataInput {
  readonly status: SendingStatus
  readonly failureMessage: string | null
  readonly recipientAddress?: string | null
  readonly amount: string
  readonly symbol: string
  readonly usdAmount?: string | null
}

function readReceivingFields(input: { readonly amount: string; readonly symbol: string }): {
  readonly amount: string
  readonly symbol: string
} {
  const amount = readSendingAmount(input.amount)

  if (amount === null) {
    throw new ReceivingsValidationError('Amount must be a number.')
  }

  const symbol = readSendingSymbol(input.symbol)

  if (symbol === null) {
    throw new ReceivingsValidationError('Asset symbol is required.')
  }

  return { amount, symbol }
}

export class ReceivingsAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReceivingsAuthError'
  }
}

export class ReceivingsValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReceivingsValidationError'
  }
}

function emptyToNull(value: string | null): string | null {
  if (value === null) {
    return null
  }

  const trimmed = value.trim()

  return trimmed === '' ? null : trimmed
}

function suppliedMetadata(input: IAssetMetadataInput): IAssetMetadata | null {
  const values = [
    input.assetChainId,
    input.assetStandard,
    input.assetName,
    input.assetDecimals,
    input.assetIsVerified,
  ]
  if (values.every((value) => value === undefined) && input.assetAddress === undefined) {
    return null
  }
  if (
    input.assetChainId === undefined ||
    input.assetStandard === undefined ||
    input.assetAddress === undefined ||
    input.assetName === undefined ||
    input.assetDecimals === undefined ||
    input.assetIsVerified === undefined
  ) {
    throw new ReceivingsValidationError('Complete asset metadata is required.')
  }
  return {
    chainId: input.assetChainId,
    standard: input.assetStandard,
    address: input.assetAddress,
    name: input.assetName,
    decimals: input.assetDecimals,
    isVerified: input.assetIsVerified,
  }
}

function requireMetadata(
  tokens: readonly IAssetToken[],
  symbol: string,
  input: IAssetMetadataInput,
): IAssetMetadata {
  let metadata: IAssetMetadata | null
  try {
    metadata = resolveAssetMetadata(tokens, symbol, suppliedMetadata(input))
  } catch (error) {
    throw settlementValidation(error)
  }
  if (metadata === null) {
    throw new ReceivingsValidationError(
      `Asset ${symbol} was not found; complete asset metadata is required.`,
    )
  }
  return metadata
}

function requireRecordMetadata(
  tokens: readonly IAssetToken[],
  record: IReceivingRecord,
): IAssetMetadata {
  if (
    record.assetChainId !== null &&
    record.assetStandard !== null &&
    record.assetName !== null &&
    record.assetDecimals !== null &&
    record.assetIsVerified !== null
  ) {
    return {
      chainId: record.assetChainId,
      standard: record.assetStandard,
      address: record.assetAddress,
      name: record.assetName,
      decimals: record.assetDecimals,
      isVerified: record.assetIsVerified,
    }
  }
  return requireMetadata(tokens, record.symbol ?? '', {})
}

function toAssetFields(metadata: IAssetMetadata): ITransferAssetFields {
  return {
    assetChainId: metadata.chainId,
    assetStandard: metadata.standard,
    assetAddress: metadata.address,
    assetName: metadata.name,
    assetDecimals: metadata.decimals,
    assetIsVerified: metadata.isVerified,
  }
}

function fromAssetFields(fields: ITransferAssetFields): IAssetMetadata {
  return {
    chainId: fields.assetChainId,
    standard: fields.assetStandard,
    address: fields.assetAddress,
    name: fields.assetName,
    decimals: fields.assetDecimals,
    isVerified: fields.assetIsVerified,
  }
}

function ownedByUser(
  records: readonly IReceivingRecord[],
  userId: string,
): readonly IReceivingRecord[] {
  return records.filter((record) => record.userId === userId)
}

function settlementValidation(error: unknown): ReceivingsValidationError {
  return error instanceof AssetSettlementError
    ? new ReceivingsValidationError(error.message)
    : new ReceivingsValidationError('Asset settlement failed.')
}
