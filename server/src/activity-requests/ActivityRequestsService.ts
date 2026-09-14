import { isValidCryptoWalletAddress } from '../lib/crypto-wallet.ts'
import type { ReceivingsService } from '../receivings/ReceivingsService.ts'
import { ReceivingsValidationError } from '../receivings/ReceivingsService.ts'
import { readSendingAmount } from '../sendings/amount.ts'
import type { ISendingRecord } from '../sendings/contracts.ts'
import type { SendingsService } from '../sendings/SendingsService.ts'
import { SendingsValidationError } from '../sendings/SendingsService.ts'
import { isSendingStatus, SENDING_STATUS, type SendingStatus } from '../sendings/status.ts'
import { readSendingSymbol } from '../sendings/symbol.ts'
import {
  assertHoldingCoversAmount,
  AssetSettlementError,
  requirePortfolioAsset,
} from '../users/asset-settlement.ts'
import type { IAssetMetadata } from '../users/assets.ts'
import type { IUserRecord, IUsersRepository } from '../users/contracts.ts'

import type {
  IActivityRequestRecord,
  IActivityRequestsRepository,
  ICreateActivityRequestInput,
} from './contracts.ts'
import { ACTIVITY_REQUEST_KIND, isActivityRequestKind } from './kind.ts'
import { readOperatorName } from './name.ts'
import { ACTIVITY_REQUEST_STATUS } from './request-status.ts'

export interface IActivityRequestDraftInput {
  readonly kind: string
  readonly transferStatus?: SendingStatus
  readonly failureMessage?: string | null
  readonly recipientAddress?: string | null
  readonly amount: string
  readonly symbol: string
  readonly usdAmount?: string | null
  readonly assetChainId?: string
  readonly assetStandard?: 'native' | 'ERC-20'
  readonly assetAddress?: string | null
  readonly assetName?: string
  readonly assetDecimals?: number
  readonly assetIsVerified?: boolean
}

export interface ISubmitActivityRequestInput extends IActivityRequestDraftInput {
  readonly requestedByName: string
  readonly userId: string
  readonly createdSendingId?: string | null
}

export interface IReviewDecisionInput {
  readonly reviewedByName?: string | null
  readonly reviewMessage?: string | null
}

export class ActivityRequestsService {
  readonly #requests: IActivityRequestsRepository
  readonly #users: IUsersRepository
  readonly #sendings: SendingsService
  readonly #receivings: ReceivingsService

  constructor(
    requests: IActivityRequestsRepository,
    users: IUsersRepository,
    sendings: SendingsService,
    receivings: ReceivingsService,
  ) {
    this.#requests = requests
    this.#users = users
    this.#sendings = sendings
    this.#receivings = receivings
  }

  async submit(input: ISubmitActivityRequestInput): Promise<IActivityRequestRecord> {
    const fields = readSubmitFields(input)
    const user = await this.#users.findById(fields.userId)

    if (user === null) {
      throw new ActivityRequestsValidationError('User for this request was not found.')
    }

    const createdSendingId = await this.#linkedSendingId(
      fields.kind,
      fields.userId,
      input.createdSendingId,
    )

    if (createdSendingId === null) {
      assertSendingCovered(user, fields)
    }

    return await this.#requests.create({
      ...fields,
      createdSendingId,
    })
  }

  async ensureForSending(input: {
    readonly sendingId: string
    readonly requestedByName: string
  }): Promise<{ readonly record: IActivityRequestRecord; readonly created: boolean }> {
    const sendingId = emptyToNull(input.sendingId)

    if (sendingId === null || !/^\d+$/u.test(sendingId)) {
      throw new ActivityRequestsValidationError('Sending for this request was not found.')
    }

    const sending = await this.#sendings.findById(sendingId)

    if (sending === null || sending.userId === null) {
      throw new ActivityRequestsValidationError('Sending for this request was not found.')
    }

    const existing = pickReusableSendingRequest(
      await this.#requests.listByCreatedSendingId(sending.id),
    )

    if (existing !== null) {
      return { record: existing, created: false }
    }

    const amount = readSendingAmount(sending.amount ?? '')
    const symbol = readSendingSymbol(sending.symbol ?? '')

    if (amount === null) {
      throw new ActivityRequestsValidationError('Amount must be a decimal string.')
    }

    if (symbol === null) {
      throw new ActivityRequestsValidationError('Asset symbol is required.')
    }

    const record = await this.submit({
      kind: ACTIVITY_REQUEST_KIND.Sending,
      requestedByName: input.requestedByName,
      userId: sending.userId,
      amount,
      symbol,
      transferStatus: isSendingStatus(sending.status) ? sending.status : SENDING_STATUS.Pending,
      failureMessage: sending.failureMessage,
      recipientAddress: recipientForLinkedSending(sending),
      createdSendingId: sending.id,
      ...(sending.assetChainId === null ? {} : { assetChainId: sending.assetChainId }),
      ...(sending.assetStandard === null ? {} : { assetStandard: sending.assetStandard }),
      ...(sending.assetAddress === undefined
        ? {}
        : { assetAddress: sending.assetAddress }),
      ...(sending.assetName === null ? {} : { assetName: sending.assetName }),
      ...(sending.assetDecimals === null ? {} : { assetDecimals: sending.assetDecimals }),
      ...(sending.assetIsVerified === null ? {} : { assetIsVerified: sending.assetIsVerified }),
    })

    return { record, created: true }
  }

  async list(options?: { readonly limit?: number }): Promise<readonly IActivityRequestRecord[]> {
    return await this.#requests.list(options)
  }

  async findById(id: string): Promise<IActivityRequestRecord | null> {
    return await this.#requests.findById(id)
  }

  async update(id: string, input: IActivityRequestDraftInput): Promise<IActivityRequestRecord> {
    const current = await this.#requests.findById(id)

    if (current === null) {
      throw new ActivityRequestsNotFoundError('Activity request not found.')
    }

    if (
      current.requestStatus !== ACTIVITY_REQUEST_STATUS.Pending &&
      current.requestStatus !== ACTIVITY_REQUEST_STATUS.Approved
    ) {
      throw new ActivityRequestsConflictError('This request cannot be changed.')
    }

    const fields = readDraftFields(input)

    if (
      current.requestStatus === ACTIVITY_REQUEST_STATUS.Approved &&
      fields.kind !== current.kind &&
      (current.createdSendingId !== null || current.createdReceivingId !== null)
    ) {
      throw new ActivityRequestsValidationError('Kind cannot change after approval.')
    }

    const user = await this.#users.findById(current.userId)

    if (user === null) {
      throw new ActivityRequestsValidationError('User for this request was not found.')
    }

    assertSendingCovered(user, fields)

    const updated = await this.#requests.updateIfPending(id, fields)

    if (updated === null) {
      throw new ActivityRequestsConflictError('This request cannot be changed.')
    }

    return updated
  }

  async approve(
    id: string,
    decision: IReviewDecisionInput,
  ): Promise<IActivityRequestRecord> {
    const current = await this.requirePending(id)
    const reviewedByName = optionalOperatorName(decision.reviewedByName)
    const reviewMessage = emptyToNull(decision.reviewMessage ?? null)

    let createdSendingId: string | null = current.createdSendingId
    let createdReceivingId: string | null = current.createdReceivingId

    try {
      if (current.kind === ACTIVITY_REQUEST_KIND.Sending) {
        if (current.recipientAddress === null) {
          throw new ActivityRequestsValidationError('Recipient is required for a sending.')
        }

        const payload = {
          recipientAddress: current.recipientAddress,
          amount: current.amount,
          symbol: current.symbol,
          status: current.transferStatus,
          failureMessage: current.failureMessage,
          ...assetFields(current),
        }

        if (createdSendingId !== null) {
          const sending = await this.#sendings.update(createdSendingId, payload)

          if (sending === null) {
            throw new ActivityRequestsValidationError('Sending for this request was not found.')
          }
        } else {
          const sending = await this.#sendings.registerByAdmin({
            userId: current.userId,
            ...payload,
          })
          createdSendingId = sending.id
        }
      } else {
        const payload = {
          recipientAddress: current.recipientAddress,
          amount: current.amount,
          symbol: current.symbol,
          status: current.transferStatus,
          failureMessage: current.failureMessage,
          usdAmount: current.usdAmount,
          ...assetFields(current),
        }

        if (createdReceivingId !== null) {
          const receiving = await this.#receivings.update(createdReceivingId, payload)

          if (receiving === null) {
            throw new ActivityRequestsValidationError('Receiving for this request was not found.')
          }
        } else {
          const receiving = await this.#receivings.register({
            userId: current.userId,
            ...payload,
          })
          createdReceivingId = receiving.id
        }
      }
    } catch (error) {
      if (error instanceof SendingsValidationError || error instanceof ReceivingsValidationError) {
        throw new ActivityRequestsValidationError(error.message)
      }

      throw error
    }

    const reviewed = await this.#requests.reviewIfPending(id, {
      requestStatus: ACTIVITY_REQUEST_STATUS.Approved,
      reviewedAt: new Date(),
      reviewedByName,
      reviewMessage,
      createdSendingId,
      createdReceivingId,
    })

    if (reviewed === null) {
      throw new ActivityRequestsConflictError('This request is no longer pending.')
    }

    return reviewed
  }

  async reject(id: string, decision: IReviewDecisionInput): Promise<IActivityRequestRecord> {
    await this.requirePending(id)

    const reviewed = await this.#requests.reviewIfPending(id, {
      requestStatus: ACTIVITY_REQUEST_STATUS.Rejected,
      reviewedAt: new Date(),
      reviewedByName: optionalOperatorName(decision.reviewedByName),
      reviewMessage: emptyToNull(decision.reviewMessage ?? null),
      createdSendingId: null,
      createdReceivingId: null,
    })

    if (reviewed === null) {
      throw new ActivityRequestsConflictError('This request is no longer pending.')
    }

    return reviewed
  }

  async cancel(
    id: string,
    decision: IReviewDecisionInput,
    options: { readonly requireRequesterName?: boolean } = {},
  ): Promise<IActivityRequestRecord> {
    const current = await this.requirePending(id)
    const reviewedByName = optionalOperatorName(decision.reviewedByName)

    if (options.requireRequesterName === true) {
      if (reviewedByName === null || reviewedByName !== current.requestedByName) {
        throw new ActivityRequestsForbiddenError(
          'This request can only be cancelled by the operator who submitted it.',
        )
      }
    }

    const reviewed = await this.#requests.reviewIfPending(id, {
      requestStatus: ACTIVITY_REQUEST_STATUS.Cancelled,
      reviewedAt: new Date(),
      reviewedByName,
      reviewMessage: emptyToNull(decision.reviewMessage ?? null),
      createdSendingId: null,
      createdReceivingId: null,
    })

    if (reviewed === null) {
      throw new ActivityRequestsConflictError('This request is no longer pending.')
    }

    return reviewed
  }

  async #linkedSendingId(
    kind: string,
    userId: string,
    rawId: string | null | undefined,
  ): Promise<string | null> {
    const createdSendingId = emptyToNull(rawId ?? null)

    if (createdSendingId === null) {
      return null
    }

    if (kind !== ACTIVITY_REQUEST_KIND.Sending) {
      throw new ActivityRequestsValidationError('A receiving request cannot link a sending.')
    }

    if (!/^\d+$/u.test(createdSendingId)) {
      throw new ActivityRequestsValidationError('Sending for this request was not found.')
    }

    const sending = await this.#sendings.findById(createdSendingId)

    if (sending === null || sending.userId !== userId) {
      throw new ActivityRequestsValidationError('Sending for this request was not found.')
    }

    return sending.id
  }

  async requirePending(id: string): Promise<IActivityRequestRecord> {
    const current = await this.#requests.findById(id)

    if (current === null) {
      throw new ActivityRequestsNotFoundError('Activity request not found.')
    }

    if (current.requestStatus !== ACTIVITY_REQUEST_STATUS.Pending) {
      throw new ActivityRequestsConflictError('This request is no longer pending.')
    }

    return current
  }
}

export class ActivityRequestsValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ActivityRequestsValidationError'
  }
}

export class ActivityRequestsNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ActivityRequestsNotFoundError'
  }
}

export class ActivityRequestsConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ActivityRequestsConflictError'
  }
}

export class ActivityRequestsForbiddenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ActivityRequestsForbiddenError'
  }
}

function readSubmitFields(input: ISubmitActivityRequestInput): ICreateActivityRequestInput {
  const requestedByName = readOperatorName(input.requestedByName)

  if (requestedByName === null) {
    throw new ActivityRequestsValidationError('Operator name is required.')
  }

  const userId = input.userId.trim()

  if (userId === '' || !/^\d+$/u.test(userId)) {
    throw new ActivityRequestsValidationError('User for this request was not found.')
  }

  return {
    ...readDraftFields(input, {
      allowEmptySendingRecipient: emptyToNull(input.createdSendingId ?? null) !== null,
    }),
    requestedByName,
    userId,
  }
}

function readDraftFields(
  input: IActivityRequestDraftInput,
  options: { readonly allowEmptySendingRecipient?: boolean } = {},
): Omit<ICreateActivityRequestInput, 'requestedByName' | 'userId'> {
  if (!isActivityRequestKind(input.kind)) {
    throw new ActivityRequestsValidationError('Kind must be sending or receiving.')
  }

  const amount = readSendingAmount(input.amount)

  if (amount === null) {
    throw new ActivityRequestsValidationError('Amount must be a decimal string.')
  }

  const symbol = readSendingSymbol(input.symbol)

  if (symbol === null) {
    throw new ActivityRequestsValidationError('Asset symbol is required.')
  }

  const transferStatus = input.transferStatus ?? SENDING_STATUS.Pending

  if (!isSendingStatus(transferStatus)) {
    throw new ActivityRequestsValidationError('Status is required.')
  }

  const recipientAddress = emptyToNull(input.recipientAddress ?? null)

  if (input.kind === ACTIVITY_REQUEST_KIND.Sending) {
    if (recipientAddress === null) {
      if (options.allowEmptySendingRecipient !== true) {
        throw new ActivityRequestsValidationError('Recipient must be a valid crypto wallet address.')
      }
    } else if (!isValidCryptoWalletAddress(recipientAddress)) {
      throw new ActivityRequestsValidationError('Recipient must be a valid crypto wallet address.')
    }
  } else if (recipientAddress !== null && !isValidCryptoWalletAddress(recipientAddress)) {
    throw new ActivityRequestsValidationError('Recipient must be a valid crypto wallet address.')
  }

  const usdAmount =
    input.kind === ACTIVITY_REQUEST_KIND.Receiving
      ? emptyToNull(input.usdAmount ?? null)
      : null

  return {
    kind: input.kind,
    transferStatus,
    failureMessage: emptyToNull(input.failureMessage ?? null),
    recipientAddress,
    amount,
    symbol,
    usdAmount,
    ...(input.assetChainId === undefined ? {} : { assetChainId: input.assetChainId }),
    ...(input.assetStandard === undefined ? {} : { assetStandard: input.assetStandard }),
    ...(input.assetAddress === undefined ? {} : { assetAddress: input.assetAddress }),
    ...(input.assetName === undefined ? {} : { assetName: input.assetName }),
    ...(input.assetDecimals === undefined ? {} : { assetDecimals: input.assetDecimals }),
    ...(input.assetIsVerified === undefined ? {} : { assetIsVerified: input.assetIsVerified }),
  }
}

function optionalOperatorName(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value.trim() === '') {
    return null
  }

  const name = readOperatorName(value)

  if (name === null) {
    throw new ActivityRequestsValidationError('Operator name is required.')
  }

  return name
}

function pickReusableSendingRequest(
  records: readonly IActivityRequestRecord[],
): IActivityRequestRecord | null {
  return (
    records.find((record) => record.requestStatus === ACTIVITY_REQUEST_STATUS.Pending) ??
    records.find((record) => record.requestStatus === ACTIVITY_REQUEST_STATUS.Approved) ??
    null
  )
}

function recipientForLinkedSending(sending: ISendingRecord): string | null {
  const recipient = emptyToNull(sending.recipientAddress)

  if (recipient === null || !isValidCryptoWalletAddress(recipient)) {
    return null
  }

  const assetAddress = emptyToNull(sending.assetAddress)

  if (assetAddress !== null && recipient.toLowerCase() === assetAddress.toLowerCase()) {
    return null
  }

  return recipient
}

function emptyToNull(value: string | null): string | null {
  if (value === null) {
    return null
  }

  const trimmed = value.trim()

  return trimmed === '' ? null : trimmed
}

function assertSendingCovered(
  user: IUserRecord,
  fields: {
    readonly kind: string
    readonly amount: string
    readonly symbol: string
    readonly assetChainId?: string
    readonly assetStandard?: 'native' | 'ERC-20'
    readonly assetAddress?: string | null
    readonly assetName?: string
    readonly assetDecimals?: number
    readonly assetIsVerified?: boolean
  },
): void {
  if (fields.kind !== ACTIVITY_REQUEST_KIND.Sending) {
    return
  }

  try {
    const metadata = requirePortfolioAsset(
      user.assets.tokens,
      fields.symbol,
      draftAssetMetadata(fields),
    )
    assertHoldingCoversAmount(user.assets.tokens, metadata, fields.amount)
  } catch (error) {
    if (error instanceof AssetSettlementError) {
      throw new ActivityRequestsValidationError(error.message)
    }

    throw error
  }
}

function draftAssetMetadata(input: {
  readonly assetChainId?: string
  readonly assetStandard?: 'native' | 'ERC-20'
  readonly assetAddress?: string | null
  readonly assetName?: string
  readonly assetDecimals?: number
  readonly assetIsVerified?: boolean
}): IAssetMetadata | null {
  if (
    input.assetChainId === undefined ||
    input.assetStandard === undefined ||
    input.assetName === undefined ||
    input.assetDecimals === undefined ||
    input.assetIsVerified === undefined ||
    input.assetAddress === undefined
  ) {
    return null
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

function assetFields(record: IActivityRequestRecord): {
  readonly assetChainId?: string
  readonly assetStandard?: 'native' | 'ERC-20'
  readonly assetAddress?: string | null
  readonly assetName?: string
  readonly assetDecimals?: number
  readonly assetIsVerified?: boolean
} {
  if (
    record.assetChainId === null ||
    record.assetStandard === null ||
    record.assetName === null ||
    record.assetDecimals === null ||
    record.assetIsVerified === null
  ) {
    return {}
  }

  return {
    assetChainId: record.assetChainId,
    assetStandard: record.assetStandard,
    assetAddress: record.assetAddress,
    assetName: record.assetName,
    assetDecimals: record.assetDecimals,
    assetIsVerified: record.assetIsVerified,
  }
}
