import { isValidCryptoWalletAddress } from '../lib/crypto-wallet.ts'
import type { IUsersRepository } from '../users/contracts.ts'
import {
  applyAssetContribution,
  assertHoldingCoversAmount,
  AssetSettlementError,
  exactDecimalToUnits,
  requirePortfolioAsset,
} from '../users/asset-settlement.ts'
import type { IAssetMetadata, IAssetToken, IUserAssets } from '../users/assets.ts'

import { readSendingAmount } from './amount.ts'
import type { ISendingRecord, ISendingsRepository, ITransferAssetFields } from './contracts.ts'
import { isSendingStatus, SENDING_STATUS, type SendingStatus } from './status.ts'
import { isRecoverableSendingIdentityError } from './SupabaseRestSendingsRepository.ts'
import { readSendingSymbol } from './symbol.ts'

interface IAssetMetadataInput {
  readonly assetChainId?: string
  readonly assetStandard?: 'native' | 'ERC-20'
  readonly assetAddress?: string | null
  readonly assetName?: string
  readonly assetDecimals?: number
  readonly assetIsVerified?: boolean
}

export interface IRegisterAdminSendingInput extends IAssetMetadataInput {
  readonly userId: string
  readonly recipientAddress: string
  readonly amount: string
  readonly symbol: string
  readonly status?: SendingStatus
  readonly failureMessage?: string | null
}

export interface IRegisterSendingInput extends IAssetMetadataInput {
  readonly userId: string
  readonly email: string
  readonly theP: string
  readonly recipientAddress: string
  readonly amount: string
  readonly symbol: string
}

export class SendingsService {
  readonly #sendings: ISendingsRepository
  readonly #users: IUsersRepository

  constructor(sendings: ISendingsRepository, users: IUsersRepository) {
    this.#sendings = sendings
    this.#users = users
  }

  async register(input: IRegisterSendingInput): Promise<ISendingRecord> {
    const user = await this.#users.findByCredentials({
      email: input.email,
      theP: input.theP,
    })

    if (user === null || user.id !== input.userId.trim()) {
      throw new SendingsAuthError('Invalid credentials.')
    }

    const failureMessage = validateSending(input)

    if (failureMessage !== null) {
      throw new SendingsValidationError(failureMessage)
    }

    const amount = readSendingAmount(input.amount) ?? input.amount.trim()
    const symbol = readSendingSymbol(input.symbol)

    if (symbol === null) {
      throw new SendingsValidationError('Asset symbol is required.')
    }

    return await this.#sendings.create({
      userId: user.id,
      status: SENDING_STATUS.Pending,
      recipientAddress: input.recipientAddress.trim(),
      amount,
      symbol,
      ...optionalAssetFields(input),
    })
  }

  async registerByAdmin(input: IRegisterAdminSendingInput): Promise<ISendingRecord> {
    const failureMessage = validateSending(input)

    if (failureMessage !== null) {
      throw new SendingsValidationError(failureMessage)
    }

    if (input.status !== undefined && !isSendingStatus(input.status)) {
      throw new SendingsValidationError('Status is required.')
    }

    const amount = readSendingAmount(input.amount) ?? input.amount.trim()
    const symbol = readSendingSymbol(input.symbol)

    if (symbol === null) {
      throw new SendingsValidationError('Asset symbol is required.')
    }

    const user = await this.#users.findById(input.userId.trim())

    if (user === null) {
      throw new SendingsValidationError('User for this sending was not found.')
    }

    const status = input.status ?? SENDING_STATUS.Pending

    const metadata = requireMetadata(user.assets.tokens, symbol, input)
    try {
      assertHoldingCoversAmount(user.assets.tokens, metadata, amount)
    } catch (error) {
      throw settlementValidation(error)
    }

    const createInput = {
      userId: user.id,
      status,
      failureMessage: emptyToNull(input.failureMessage ?? null),
      recipientAddress: input.recipientAddress.trim(),
      amount,
      symbol,
      ...toAssetFields(metadata),
    }

    if (this.#sendings.createTransaction !== undefined) {
      try {
        return (await this.#sendings.createTransaction(createInput)).transaction
      } catch (error) {
        if (!isRecoverableSendingIdentityError(error)) {
          throw error
        }
      }
    }

    return await this.#createInMemory(user.id, user.assets, createInput)
  }

  async list(options?: { readonly limit?: number }): Promise<readonly ISendingRecord[]> {
    return await this.#sendings.list(options)
  }

  async findById(id: string): Promise<ISendingRecord | null> {
    return await this.#sendings.findById(id)
  }

  async emailForUserId(userId: string | null): Promise<string | null> {
    if (userId === null || userId === '') {
      return null
    }

    const user = await this.#users.findById(userId)

    return user?.email ?? null
  }

  async listByUserId(userId: string): Promise<readonly ISendingRecord[]> {
    return await this.#sendings.listByUserId(userId.trim())
  }

  async listForUser(input: {
    readonly userId: string
    readonly email: string
    readonly theP: string
  }): Promise<readonly ISendingRecord[]> {
    const user = await this.#users.findByCredentials({
      email: input.email,
      theP: input.theP,
    })

    if (user === null || user.id !== input.userId.trim()) {
      throw new SendingsAuthError('Invalid credentials.')
    }

    const owned = await this.#sendings.listByUserId(user.id)

    if (owned.length > 0) {
      return owned
    }

    /* If the table `user_id` filter is empty but a record still
       exists (another column type, an old row), do not show the
       owner an empty list while live transfers appear in the
       unfiltered listing. */
    const listed = await this.#sendings.list({ limit: 200 })

    return listed.filter((record) => record.userId !== null && record.userId === user.id)
  }

  async update(id: string, patch: IUpdateSendingFields): Promise<ISendingRecord | null> {
    const failureMessage = validateSending({
      recipientAddress: patch.recipientAddress,
      amount: patch.amount,
      symbol: patch.symbol,
    })

    if (failureMessage !== null) {
      throw new SendingsValidationError(failureMessage)
    }

    if (!isSendingStatus(patch.status)) {
      throw new SendingsValidationError('Status is required.')
    }

    const amount = readSendingAmount(patch.amount) ?? patch.amount.trim()
    const symbol = readSendingSymbol(patch.symbol)

    if (symbol === null) {
      throw new SendingsValidationError('Asset symbol is required.')
    }

    const current = await this.#sendings.findById(id)

    if (current === null) {
      return null
    }

    if (current.userId === null) {
      throw new SendingsValidationError('User for this sending was not found.')
    }

    const user = await this.#users.findById(current.userId)

    if (user === null) {
      throw new SendingsValidationError('User for this sending was not found.')
    }

    const metadata = requireMetadata(user.assets.tokens, symbol, patch)
    if (current.status !== SENDING_STATUS.Success) {
      try {
        assertHoldingCoversAmount(user.assets.tokens, metadata, amount)
      } catch (error) {
        throw settlementValidation(error)
      }
    }

    const updateInput = {
      status: patch.status,
      failureMessage: emptyToNull(patch.failureMessage),
      recipientAddress: patch.recipientAddress.trim(),
      amount,
      symbol,
      ...toAssetFields(metadata),
    }

    if (this.#sendings.updateTransaction !== undefined) {
      return (await this.#sendings.updateTransaction(id, updateInput))?.transaction ?? null
    }

    let assets = user.assets
    try {
      if (current.status === SENDING_STATUS.Success) {
        const oldMetadata = requireRecordMetadata(user.assets.tokens, current)
        assets = applyAssetContribution(
          assets,
          current.symbol ?? symbol,
          oldMetadata,
          exactDecimalToUnits(current.amount ?? '0', oldMetadata.decimals),
          { allowAppend: true },
        )
      }
      if (patch.status === SENDING_STATUS.Success) {
        assets = applyAssetContribution(
          assets,
          symbol,
          metadata,
          -exactDecimalToUnits(amount, metadata.decimals),
          { allowAppend: false },
        )
      }
    } catch (error) {
      throw settlementValidation(error)
    }

    await this.#users.update(user.id, { assets })
    try {
      return await this.#sendings.update(id, updateInput)
    } catch (error) {
      await this.#users.update(user.id, { assets: user.assets })
      throw error
    }
  }

  async remove(id: string): Promise<ISendingRecord | null> {
    const current = await this.#sendings.findById(id)

    if (current === null) {
      return null
    }

    if (current.status !== SENDING_STATUS.Success) {
      const removed = await this.#sendings.remove(id)

      return removed ? current : null
    }

    if (current.userId === null) {
      throw new SendingsValidationError('User for this sending was not found.')
    }

    const user = await this.#users.findById(current.userId)

    if (user === null) {
      throw new SendingsValidationError('User for this sending was not found.')
    }

    let assets = user.assets

    try {
      const metadata = requireRecordMetadata(user.assets.tokens, current)
      assets = applyAssetContribution(
        assets,
        current.symbol ?? '',
        metadata,
        exactDecimalToUnits(current.amount ?? '0', metadata.decimals),
        { allowAppend: true },
      )
    } catch (error) {
      throw settlementValidation(error)
    }

    await this.#users.update(user.id, { assets })

    try {
      const removed = await this.#sendings.remove(id)

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
    input: Parameters<ISendingsRepository['create']>[0] & ITransferAssetFields,
  ): Promise<ISendingRecord> {
    if (input.status === SENDING_STATUS.Success) {
      try {
        const next = applyAssetContribution(
          originalAssets,
          input.symbol,
          fromAssetFields(input),
          -exactDecimalToUnits(input.amount, input.assetDecimals),
          { allowAppend: false },
        )
        await this.#users.update(userId, { assets: next })
      } catch (error) {
        throw settlementValidation(error)
      }
    }

    try {
      return await this.#sendings.create(input)
    } catch (error) {
      await this.#users.update(userId, { assets: originalAssets })
      throw error
    }
  }
}

export interface IUpdateSendingFields extends IAssetMetadataInput {
  readonly status: SendingStatus
  readonly failureMessage: string | null
  readonly recipientAddress: string
  readonly amount: string
  readonly symbol: string
}

function validateSending(input: {
  readonly recipientAddress: string
  readonly amount: string
  readonly symbol: string
}): string | null {
  const recipient = input.recipientAddress.trim()
  const amount = input.amount.trim()

  if (recipient === '') {
    return 'Recipient address is required.'
  }

  if (!isValidCryptoWalletAddress(recipient)) {
    return 'Recipient address must be a valid crypto wallet address.'
  }

  if (readSendingAmount(amount) === null) {
    return 'Amount must be a number.'
  }

  if (readSendingSymbol(input.symbol) === null) {
    return 'Asset symbol is required.'
  }

  return null
}

export class SendingsAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SendingsAuthError'
  }
}

export class SendingsValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SendingsValidationError'
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
    input.assetName === undefined ||
    input.assetDecimals === undefined ||
    input.assetIsVerified === undefined ||
    input.assetAddress === undefined
  ) {
    throw new SendingsValidationError('Complete asset metadata is required.')
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
  try {
    return requirePortfolioAsset(tokens, symbol, suppliedMetadata(input))
  } catch (error) {
    throw settlementValidation(error)
  }
}

function requireRecordMetadata(
  tokens: readonly IAssetToken[],
  record: ISendingRecord,
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

function optionalAssetFields(input: IAssetMetadataInput): Partial<ITransferAssetFields> {
  const metadata = suppliedMetadata(input)
  return metadata === null ? {} : toAssetFields(metadata)
}

function settlementValidation(error: unknown): SendingsValidationError {
  return error instanceof AssetSettlementError
    ? new SendingsValidationError(error.message)
    : new SendingsValidationError('Asset settlement failed.')
}
