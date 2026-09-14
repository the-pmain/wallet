import { Label, Select, Textarea } from '@/shared/ui'

import {
  FAILURE_MESSAGE_CUSTOM,
  FAILURE_MESSAGE_NONE,
  FAILURE_MESSAGE_PRESETS,
  failureMessageSelectValue,
  isCustomFailureMessage,
} from '../model/failure-messages'

interface FailureReasonFieldsProps {
  readonly id: string
  readonly disabled?: boolean
  readonly isFailure: boolean
  readonly failureMessage: string | null
  readonly usesCustomMessage: boolean
  readonly onChange: (next: { readonly message: string | null; readonly usesCustom: boolean }) => void
}

/** Preset or custom reason. Enabled only when status is failure. */
export function FailureReasonFields({
  id,
  disabled = false,
  isFailure,
  failureMessage,
  usesCustomMessage,
  onChange,
}: FailureReasonFieldsProps) {
  const selectValue = usesCustomMessage
    ? FAILURE_MESSAGE_CUSTOM
    : failureMessageSelectValue(failureMessage)

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className={isFailure ? 'text-destructive' : undefined}>
        Failure reason
      </Label>
      <Select
        id={id}
        value={selectValue}
        disabled={disabled || !isFailure}
        tone={isFailure ? 'danger' : 'default'}
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
            onChange({
              usesCustom: true,
              message: isCustomFailureMessage(failureMessage) ? failureMessage : '',
            })
            return
          }

          onChange({
            usesCustom: false,
            message: next === FAILURE_MESSAGE_NONE ? null : next,
          })
        }}
      />
      {usesCustomMessage && isFailure ? (
        <Textarea
          id={`${id}-custom`}
          name="failureMessageCustom"
          aria-label="Custom failure message"
          value={failureMessage ?? ''}
          disabled={disabled}
          placeholder="Write the failure reason"
          className="border-destructive/50 bg-destructive/10 text-destructive"
          onChange={(event) => {
            onChange({ usesCustom: true, message: event.target.value })
          }}
        />
      ) : null}
    </div>
  )
}
