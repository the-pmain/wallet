import { useId, useState, type FormEvent } from 'react'

import type { IRemoteReceiving } from '@/features/onboarding'
import {
  SENDING_STATUS,
  SENDING_STATUSES,
  type SendingStatus,
} from '@/features/onboarding'
import { Button, Dialog, Input, Label, Select, Textarea } from '@/shared/ui'

import { formatAdminTimestamp } from '../lib/format-admin-timestamp'
import type { IAdminReceivingPatch } from '../model/AdminClient'
import {
  addableAssetForTransfer,
  transactionAssetMetadata,
} from '../model/addable-assets'
import {
  FAILURE_MESSAGE_CUSTOM,
  FAILURE_MESSAGE_NONE,
  FAILURE_MESSAGE_PRESETS,
  failureMessageSelectValue,
  isCustomFailureMessage,
} from '../model/failure-messages'
import { defaultTransferAsset, TransferAssetSelect } from './TransferAssetSelect'

interface ReceivingEditDialogProps {
  readonly receiving: IRemoteReceiving | null
  readonly userEmail: string
  readonly isBusy: boolean
  readonly error: string | null
  readonly onClose: () => void
  readonly onSave: (id: string, patch: IAdminReceivingPatch) => void
  readonly onDelete: (id: string) => void
}

export function ReceivingEditDialog({
  receiving,
  userEmail,
  isBusy,
  error,
  onClose,
  onSave,
  onDelete,
}: ReceivingEditDialogProps) {
  const fieldId = useId()
  const [draft, setDraft] = useState<IAdminReceivingPatch>(() =>
    receiving === null ? emptyDraft() : draftFromReceiving(receiving),
  )
  const [usesCustomMessage, setUsesCustomMessage] = useState(() =>
    isCustomFailureMessage(receiving?.failureMessage),
  )

  const isOpen = receiving !== null
  const isFailure = draft.status === SENDING_STATUS.Failure
  const hasFailureReason = (draft.failureMessage ?? '').trim() !== ''
  const canSave = !isBusy && (!isFailure || hasFailureReason)
  const failureSelectValue = usesCustomMessage
    ? FAILURE_MESSAGE_CUSTOM
    : failureMessageSelectValue(draft.failureMessage)
  const selectedAsset = addableAssetForTransfer(draft) ?? defaultTransferAsset()

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()

    if (receiving === null || !canSave) {
      return
    }

    onSave(receiving.id, {
      status: draft.status,
      failureMessage: draft.failureMessage === '' ? null : draft.failureMessage,
      recipientAddress: draft.recipientAddress ?? null,
      amount: draft.amount.trim(),
      symbol: draft.symbol.trim(),
      usdAmount: draft.usdAmount ?? null,
      assetChainId: draft.assetChainId,
      assetStandard: draft.assetStandard,
      assetAddress: draft.assetAddress,
      assetName: draft.assetName,
      assetDecimals: draft.assetDecimals,
      assetIsVerified: draft.assetIsVerified,
    })
  }

  function handleDelete(): void {
    if (receiving === null || isBusy) {
      return
    }

    if (!window.confirm('Delete this receiving? This cannot be undone.')) {
      return
    }

    onDelete(receiving.id)
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Edit receiving"
      description="Change the asset, amount, status, or failure reason. ID, created time, and user stay as they are."
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
      {receiving === null ? null : (
        <form id={`${fieldId}-form`} className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <p className="text-sm text-muted-foreground">
            id {receiving.id} · user {userEmail} ·{' '}
            {formatAdminTimestamp(receiving.createdAt)}
          </p>
          {error === null ? null : <p className="text-sm text-destructive">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${fieldId}-status`} className={isFailure ? 'text-destructive' : undefined}>
              Status
            </Label>
            <Select
              id={`${fieldId}-status`}
              value={draft.status}
              disabled={isBusy}
              menuPlacement="top"
              tone={
                isFailure ? 'danger' : draft.status === SENDING_STATUS.Success ? 'success' : 'default'
              }
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
            <Label htmlFor={`${fieldId}-failure`} className={isFailure ? 'text-destructive' : undefined}>
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
              onChange={(value) => {
                if (value === FAILURE_MESSAGE_CUSTOM) {
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
                  failureMessage: value === FAILURE_MESSAGE_NONE ? null : value,
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
        </form>
      )}
    </Dialog>
  )
}

function emptyDraft(): IAdminReceivingPatch {
  const asset = defaultTransferAsset()

  return {
    status: SENDING_STATUS.Pending,
    failureMessage: null,
    recipientAddress: null,
    amount: '',
    symbol: asset.token.symbol,
    ...transactionAssetMetadata(asset.token),
    usdAmount: null,
  }
}

function draftFromReceiving(receiving: IRemoteReceiving): IAdminReceivingPatch {
  const asset = addableAssetForTransfer(receiving) ?? defaultTransferAsset()
  const metadata =
    typeof receiving.assetChainId === 'string' &&
    receiving.assetStandard !== null &&
    receiving.assetStandard !== undefined &&
    typeof receiving.assetName === 'string' &&
    typeof receiving.assetDecimals === 'number' &&
    typeof receiving.assetIsVerified === 'boolean'
      ? {
          assetChainId: receiving.assetChainId,
          assetStandard: receiving.assetStandard,
          assetAddress: receiving.assetAddress ?? null,
          assetName: receiving.assetName,
          assetDecimals: receiving.assetDecimals,
          assetIsVerified: receiving.assetIsVerified,
        }
      : transactionAssetMetadata(asset.token)

  return {
    status: receiving.status ?? SENDING_STATUS.Pending,
    failureMessage: receiving.failureMessage,
    recipientAddress: receiving.recipientAddress,
    amount: receiving.amount ?? '',
    symbol: asset.token.symbol,
    usdAmount: receiving.usdAmount,
    ...metadata,
  }
}
