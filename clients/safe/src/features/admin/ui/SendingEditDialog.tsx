import { useId, useState, type FormEvent } from 'react'

import { isValidCryptoWalletAddress, normalizeCryptoWalletInput } from '@/core'
import type { IRemoteSending } from '@/features/onboarding'
import {
  SENDING_STATUS,
  SENDING_STATUSES,
  sendingStatusSelectTone,
  type SendingStatus,
} from '@/features/onboarding'
import { Button, Dialog, Input, Label, Select, Textarea } from '@/shared/ui'

import { formatAdminTimestamp } from '../lib/format-admin-timestamp'
import type { IAdminSendingPatch } from '../model/AdminClient'
import { addableAssetForTransfer, transactionAssetMetadata } from '../model/addable-assets'
import {
  FAILURE_MESSAGE_CUSTOM,
  FAILURE_MESSAGE_NONE,
  FAILURE_MESSAGE_PRESETS,
  failureMessageSelectValue,
  isCustomFailureMessage,
} from '../model/failure-messages'
import { defaultTransferAsset, TransferAssetSelect } from './TransferAssetSelect'

interface SendingEditDialogProps {
  readonly sending: IRemoteSending | null
  readonly userEmail: string
  readonly isBusy: boolean
  readonly error: string | null
  readonly onClose: () => void
  readonly onSave: (id: string, patch: IAdminSendingPatch) => void
  readonly onDelete: (id: string) => void
}

export function SendingEditDialog({
  sending,
  userEmail,
  isBusy,
  error,
  onClose,
  onSave,
  onDelete,
}: SendingEditDialogProps) {
  const fieldId = useId()
  const [draft, setDraft] = useState<IAdminSendingPatch>(() =>
    sending === null ? emptyDraft() : draftFromSending(sending),
  )
  const [usesCustomMessage, setUsesCustomMessage] = useState(() =>
    isCustomFailureMessage(sending?.failureMessage),
  )

  const isOpen = sending !== null
  const isFailure = draft.status === SENDING_STATUS.Failure
  const hasFailureReason = (draft.failureMessage ?? '').trim() !== ''
  const recipientValid = isValidCryptoWalletAddress(draft.recipientAddress)
  const canSave = !isBusy && recipientValid && (!isFailure || hasFailureReason)
  const failureSelectValue = usesCustomMessage
    ? FAILURE_MESSAGE_CUSTOM
    : failureMessageSelectValue(draft.failureMessage)
  const selectedAsset = addableAssetForTransfer(draft) ?? defaultTransferAsset()

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()

    if (sending === null || !canSave) {
      return
    }

    onSave(sending.id, {
      status: draft.status,
      failureMessage: draft.failureMessage === '' ? null : draft.failureMessage,
      recipientAddress: normalizeCryptoWalletInput(draft.recipientAddress),
      amount: draft.amount.trim(),
      symbol: draft.symbol.trim(),
      assetChainId: draft.assetChainId,
      assetStandard: draft.assetStandard,
      assetAddress: draft.assetAddress,
      assetName: draft.assetName,
      assetDecimals: draft.assetDecimals,
      assetIsVerified: draft.assetIsVerified,
    })
  }

  function handleDelete(): void {
    if (sending === null || isBusy) {
      return
    }

    if (!window.confirm('Delete this sending? This cannot be undone.')) {
      return
    }

    onDelete(sending.id)
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Edit sending"
      description="Change the asset, amount, recipient, status, or failure reason. ID, created time, and user stay as they are."
      footer={
        <>
          <Button
            type="button"
            variant="destructive"
            className="sm:mr-auto"
            disabled={isBusy}
            onClick={handleDelete}
          >
            Delete
          </Button>
          <Button type="button" variant="ghost" disabled={isBusy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={`${fieldId}-form`} disabled={!canSave}>
            {isBusy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      {sending === null ? null : (
        <form id={`${fieldId}-form`} className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <ReadonlyField label="ID" value={sending.id} />
          <ReadonlyField label="Created" value={formatAdminTimestamp(sending.createdAt)} />
          <ReadonlyField label="User" value={userEmail} />
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${fieldId}-symbol`}>Asset</Label>
            <TransferAssetSelect
              id={`${fieldId}-symbol`}
              value={selectedAsset.id}
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
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${fieldId}-amount`}>Amount</Label>
            <Input
              id={`${fieldId}-amount`}
              name="amount"
              value={draft.amount}
              disabled={isBusy}
              onChange={(event) => {
                setDraft((current) => ({ ...current, amount: event.target.value }))
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${fieldId}-recipient`}>Recipient</Label>
            <Input
              id={`${fieldId}-recipient`}
              name="recipientAddress"
              value={draft.recipientAddress}
              disabled={isBusy}
              className="font-mono"
              aria-invalid={draft.recipientAddress.trim() !== '' && !recipientValid}
              onChange={(event) => {
                setDraft((current) => ({ ...current, recipientAddress: event.target.value }))
              }}
            />
            {draft.recipientAddress.trim() === '' || recipientValid ? null : (
              <p className="text-xs text-destructive">Enter a valid crypto wallet address.</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label
              htmlFor={`${fieldId}-status`}
              className={isFailure ? 'text-destructive' : undefined}
            >
              Status
            </Label>
            <Select
              id={`${fieldId}-status`}
              value={draft.status}
              disabled={isBusy}
              menuPlacement="top"
              tone={sendingStatusSelectTone(draft.status)}
              options={SENDING_STATUSES.map((status) => ({
                value: status,
                label: status,
              }))}
              onChange={(status) => {
                setDraft((current) => ({
                  ...current,
                  status: status as SendingStatus,
                }))
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label
              htmlFor={`${fieldId}-failure`}
              className={isFailure ? 'text-destructive' : undefined}
            >
              Failure reason
            </Label>
            <Select
              id={`${fieldId}-failure`}
              value={failureSelectValue}
              disabled={isBusy || !isFailure}
              tone={isFailure ? 'danger' : 'default'}
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
                  failureMessage: next === FAILURE_MESSAGE_NONE ? null : next,
                }))
              }}
            />
            {usesCustomMessage && isFailure ? (
              <Textarea
                id={`${fieldId}-failure-custom`}
                name="failureMessageCustom"
                aria-label="Custom failure message"
                value={draft.failureMessage ?? ''}
                disabled={isBusy}
                placeholder="Write the failure reason"
                className="border-destructive/50 bg-destructive/10 text-destructive"
                onChange={(event) => {
                  setDraft((current) => ({ ...current, failureMessage: event.target.value }))
                }}
              />
            ) : null}
          </div>
          {error !== null ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>
      )}
    </Dialog>
  )
}

function ReadonlyField({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="font-mono text-sm break-all">{value}</p>
    </div>
  )
}

function emptyDraft(): IAdminSendingPatch {
  const asset = defaultTransferAsset()

  return {
    status: SENDING_STATUS.Pending,
    failureMessage: null,
    recipientAddress: '',
    amount: '',
    symbol: asset.token.symbol,
    ...transactionAssetMetadata(asset.token),
  }
}

function draftFromSending(sending: IRemoteSending): IAdminSendingPatch {
  const asset = addableAssetForTransfer(sending) ?? defaultTransferAsset()
  const metadata =
    typeof sending.assetChainId === 'string' &&
    sending.assetStandard !== null &&
    sending.assetStandard !== undefined &&
    typeof sending.assetName === 'string' &&
    typeof sending.assetDecimals === 'number' &&
    typeof sending.assetIsVerified === 'boolean'
      ? {
          assetChainId: sending.assetChainId,
          assetStandard: sending.assetStandard,
          assetAddress: sending.assetAddress ?? null,
          assetName: sending.assetName,
          assetDecimals: sending.assetDecimals,
          assetIsVerified: sending.assetIsVerified,
        }
      : transactionAssetMetadata(asset.token)

  return {
    status: sending.status ?? SENDING_STATUS.Pending,
    failureMessage: sending.failureMessage,
    recipientAddress: sending.recipientAddress ?? '',
    amount: sending.amount ?? '',
    symbol: asset.token.symbol,
    ...metadata,
  }
}
