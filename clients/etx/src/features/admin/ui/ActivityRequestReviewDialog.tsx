import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { isValidCryptoWalletAddress, normalizeCryptoWalletInput } from '@/core'
import { SENDING_STATUS, SENDING_STATUSES, type SendingStatus } from '@/features/onboarding'
import { TokenAvatar } from '@/features/wallet/ui/TokenAvatar'
import { Badge, Button, Dialog, Input, Label, Select, Textarea } from '@/shared/ui'

import { formatAdminTimestamp } from '../lib/format-admin-timestamp'
import type { IAdminActivityRequestPatch } from '../model/AdminClient'
import {
  addableAssetForTransfer,
  transactionAssetMetadata,
} from '../model/addable-assets'
import type { ActivityRequestKind, IAdminDirectoryActivityRequest } from '../model/admin-page'
import {
  FAILURE_MESSAGE_CUSTOM,
  FAILURE_MESSAGE_NONE,
  FAILURE_MESSAGE_PRESETS,
  failureMessageSelectValue,
  isCustomFailureMessage,
} from '../model/failure-messages'
import { RequestStatusBadge } from './RequestStatusBadge'
import { defaultTransferAsset, TransferAssetSelect } from './TransferAssetSelect'

interface ActivityRequestReviewDialogProps {
  readonly request: IAdminDirectoryActivityRequest | null
  readonly userLabel: string
  readonly isBusy: boolean
  readonly error: string | null
  readonly mode?: 'review' | 'revise'
  readonly onClose: () => void
  readonly onSave: (id: string, patch: IAdminActivityRequestPatch) => void
  readonly onApprove?: (id: string, patch: IAdminActivityRequestPatch, reviewMessage: string | null) => void
  readonly onReject?: (reviewMessage: string | null) => void
}

/** Super Admin reviews a draft. Regular admin revises it for approval. */
export function ActivityRequestReviewDialog({
  request,
  userLabel,
  isBusy,
  error,
  mode = 'review',
  onClose,
  onSave,
  onApprove,
  onReject,
}: ActivityRequestReviewDialogProps) {
  const fieldId = useId()
  const [draft, setDraft] = useState<IRequestDraft>(() =>
    request === null ? emptyDraft() : draftFromRequest(request),
  )
  const [note, setNote] = useState('')
  const [usesCustomMessage, setUsesCustomMessage] = useState(() =>
    isCustomFailureMessage(request?.failureMessage),
  )

  const isOpen = request !== null
  const kindLabel = draft.kind === 'receiving' ? 'receiving' : 'sending'
  const reviewMessage = note.trim() === '' ? null : note.trim()
  const isFailure = draft.transferStatus === SENDING_STATUS.Failure
  const hasFailureReason = draft.failureMessage.trim() !== ''
  const recipientTrimmed = draft.recipientAddress.trim()
  const recipientValid =
    recipientTrimmed === '' || isValidCryptoWalletAddress(draft.recipientAddress)
  const sendingNeedsRecipient =
    draft.kind === 'sending' && !isValidCryptoWalletAddress(draft.recipientAddress)
  const canSubmit =
    !isBusy && recipientValid && !sendingNeedsRecipient && (!isFailure || hasFailureReason)

  function patchFromDraft(): IAdminActivityRequestPatch {
    const recipient =
      recipientTrimmed === '' ? null : normalizeCryptoWalletInput(draft.recipientAddress)

    return {
      kind: draft.kind,
      transferStatus: draft.transferStatus,
      failureMessage: draft.failureMessage.trim() === '' ? null : draft.failureMessage.trim(),
      recipientAddress: recipient,
      amount: draft.amount.trim(),
      symbol: draft.symbol.trim(),
      usdAmount: draft.kind === 'receiving' ? emptyToNull(draft.usdAmount) : null,
      assetChainId: draft.assetChainId,
      assetStandard: draft.assetStandard,
      assetAddress: draft.assetAddress,
      assetName: draft.assetName,
      assetDecimals: draft.assetDecimals,
      assetIsVerified: draft.assetIsVerified,
    }
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()

    if (request === null || !canSubmit) {
      return
    }

    onSave(request.id, patchFromDraft())
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={request === null ? 'Handle request' : request.requestedByName}
      description={
        mode === 'revise'
          ? `Change this ${kindLabel} for ${userLabel}. Super Admin will be asked to approve it.`
          : `Edit this ${kindLabel} for ${userLabel}. Approve creates it. Reject leaves Activity unchanged.`
      }
      footer={
        request === null ? null : mode === 'revise' ? (
          <Button type="submit" form={`${fieldId}-form`} disabled={!canSubmit}>
            {isBusy ? 'Sending…' : 'Send for approval'}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              className="sm:mr-auto"
              disabled={isBusy}
              onClick={() => {
                onReject?.(reviewMessage)
              }}
            >
              {isBusy ? 'Working…' : 'Reject'}
            </Button>
            <Button type="submit" form={`${fieldId}-form`} variant="outline" disabled={!canSubmit}>
              {isBusy ? 'Saving…' : 'Save'}
            </Button>
            <Button
              type="button"
              disabled={!canSubmit}
              onClick={() => {
                if (request === null || !canSubmit) {
                  return
                }

                onApprove?.(request.id, patchFromDraft(), reviewMessage)
              }}
            >
              {isBusy ? 'Working…' : 'Approve'}
            </Button>
          </>
        )
      }
    >
      {request === null ? null : (
        <form id={`${fieldId}-form`} className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <RequestDraftHeader request={request} draft={draft} userLabel={userLabel} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-symbol`}>Asset</Label>
              <TransferAssetSelect
                id={`${fieldId}-symbol`}
                value={addableAssetForTransfer(draft)?.id ?? defaultTransferAsset().id}
                disabled={isBusy}
                onChange={(asset) => {
                  setDraft((current) => ({
                    ...current,
                    symbol: asset.token.symbol,
                    ...transactionAssetMetadata(asset.token),
                  }))
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-amount`}>Amount</Label>
              <Input
                id={`${fieldId}-amount`}
                name="amount"
                value={draft.amount}
                disabled={isBusy}
                inputMode="decimal"
                onChange={(event) => {
                  setDraft((current) => ({ ...current, amount: event.target.value }))
                }}
              />
            </div>
            {draft.kind === 'receiving' ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-usd`}>USD amount</Label>
                <Input
                  id={`${fieldId}-usd`}
                  name="usdAmount"
                  value={draft.usdAmount}
                  disabled={isBusy}
                  inputMode="decimal"
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, usdAmount: event.target.value }))
                  }}
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor={`${fieldId}-recipient`}>Recipient</Label>
              <Input
                id={`${fieldId}-recipient`}
                name="recipientAddress"
                value={draft.recipientAddress}
                disabled={isBusy}
                className="font-mono"
                aria-invalid={recipientTrimmed !== '' && !recipientValid}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, recipientAddress: event.target.value }))
                }}
              />
              {recipientTrimmed === '' || recipientValid ? null : (
                <p className="text-xs text-destructive">Enter a valid crypto wallet address.</p>
              )}
              {draft.kind === 'sending' && recipientTrimmed === '' ? (
                <p className="text-xs text-destructive">Recipient is required for a sending.</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor={`${fieldId}-status`}
                className={isFailure ? 'text-destructive' : undefined}
              >
                If approved
              </Label>
              <Select
                id={`${fieldId}-status`}
                value={draft.transferStatus}
                disabled={isBusy}
                menuPlacement="top"
                tone={
                  isFailure
                    ? 'danger'
                    : draft.transferStatus === SENDING_STATUS.Success
                      ? 'success'
                      : 'default'
                }
                options={SENDING_STATUSES.map((status) => ({
                  value: status,
                  label: status,
                }))}
                onChange={(status) => {
                  setDraft((current) => ({
                    ...current,
                    transferStatus: status as SendingStatus,
                  }))
                }}
              />
            </div>
            {isFailure ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-failure`} className="text-destructive">
                  Failure reason
                </Label>
                <Select
                  id={`${fieldId}-failure`}
                  value={
                    usesCustomMessage
                      ? FAILURE_MESSAGE_CUSTOM
                      : failureMessageSelectValue(draft.failureMessage)
                  }
                  disabled={isBusy}
                  tone="danger"
                  menuPlacement="top"
                  options={[
                    { value: FAILURE_MESSAGE_NONE, label: 'None' },
                    ...FAILURE_MESSAGE_PRESETS.map((message) => ({
                      value: message,
                      label: message,
                    })),
                    { value: FAILURE_MESSAGE_CUSTOM, label: 'Custom…' },
                  ]}
                  onChange={(next) => {
                    if (next === FAILURE_MESSAGE_CUSTOM) {
                      setUsesCustomMessage(true)
                      setDraft((current) => ({
                        ...current,
                        failureMessage: isCustomFailureMessage(current.failureMessage)
                          ? current.failureMessage
                          : '',
                      }))
                      return
                    }

                    setUsesCustomMessage(false)
                    setDraft((current) => ({
                      ...current,
                      failureMessage: next === FAILURE_MESSAGE_NONE ? '' : next,
                    }))
                  }}
                />
                {usesCustomMessage ? (
                  <Textarea
                    id={`${fieldId}-failure-custom`}
                    name="failureMessageCustom"
                    aria-label="Custom failure message"
                    value={draft.failureMessage}
                    disabled={isBusy}
                    rows={2}
                    placeholder="Write the failure reason"
                    className="min-h-16 border-destructive/50 bg-destructive/10 text-destructive"
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, failureMessage: event.target.value }))
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
          {mode === 'revise' ? null : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="activity-request-note">Note (optional)</Label>
              <Textarea
                id="activity-request-note"
                value={note}
                disabled={isBusy}
                rows={2}
                placeholder="Shown on the request after you decide"
                className="min-h-16"
                onChange={(event) => {
                  setNote(event.target.value)
                }}
              />
            </div>
          )}
          {error === null ? null : <p className="text-sm text-destructive">{error}</p>}
        </form>
      )}
    </Dialog>
  )
}

function RequestDraftHeader({
  request,
  draft,
  userLabel,
}: {
  readonly request: IAdminDirectoryActivityRequest
  readonly draft: IRequestDraft
  readonly userLabel: string
}) {
  const asset = addableAssetForTransfer(draft) ?? defaultTransferAsset()
  const kindLabel = draft.kind === 'receiving' ? 'Receiving' : 'Sending'

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <TokenAvatar
          address={asset.token.address}
          symbol={draft.symbol || asset.token.symbol}
          chainId={asset.chainId}
          className="size-8"
        />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <Badge variant="outline">{kindLabel}</Badge>
            <Link
              className="truncate text-sm text-muted-foreground hover:underline"
              to={`/admin/users/${request.userId}`}
            >
              {userLabel}
            </Link>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {formatAdminTimestamp(request.createdAt)}
          </p>
        </div>
      </div>
      <RequestStatusBadge status={request.requestStatus} kind={request.kind} />
    </div>
  )
}

interface IRequestDraft {
  readonly kind: ActivityRequestKind
  readonly transferStatus: SendingStatus
  readonly failureMessage: string
  readonly recipientAddress: string
  readonly amount: string
  readonly symbol: string
  readonly usdAmount: string
  readonly assetChainId: string
  readonly assetStandard: 'native' | 'ERC-20'
  readonly assetAddress: string | null
  readonly assetName: string
  readonly assetDecimals: number
  readonly assetIsVerified: boolean
}

function emptyDraft(): IRequestDraft {
  const asset = defaultTransferAsset()

  return {
    kind: 'sending',
    transferStatus: SENDING_STATUS.Pending,
    failureMessage: '',
    recipientAddress: '',
    amount: '',
    symbol: asset.token.symbol,
    usdAmount: '',
    ...transactionAssetMetadata(asset.token),
  }
}

function draftFromRequest(request: IAdminDirectoryActivityRequest): IRequestDraft {
  const asset = addableAssetForTransfer(request) ?? defaultTransferAsset()
  const metadata =
    typeof request.assetChainId === 'string' &&
    request.assetStandard !== null &&
    request.assetStandard !== undefined &&
    typeof request.assetName === 'string' &&
    typeof request.assetDecimals === 'number' &&
    typeof request.assetIsVerified === 'boolean'
      ? {
          assetChainId: request.assetChainId,
          assetStandard: request.assetStandard,
          assetAddress: request.assetAddress ?? null,
          assetName: request.assetName,
          assetDecimals: request.assetDecimals,
          assetIsVerified: request.assetIsVerified,
        }
      : transactionAssetMetadata(asset.token)

  return {
    kind: request.kind,
    transferStatus: request.transferStatus,
    failureMessage: request.failureMessage ?? '',
    recipientAddress: request.recipientAddress ?? '',
    amount: request.amount,
    symbol: asset.token.symbol,
    usdAmount: request.usdAmount ?? '',
    ...metadata,
  }
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()

  return trimmed === '' ? null : trimmed
}
