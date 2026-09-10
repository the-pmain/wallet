import type { ComponentType } from 'react'

import { cn } from '@/shared/lib/utils'

export interface ISegmentedOption<TValue extends string | number> {
  readonly value: TValue
  readonly label: string

  /**
   * Icon next to the label.
   *
   * Optional: history filters have none, theme choice has one.
   * The icon supplements the label and does not replace it — a
   * set of icons alone forces guessing, and a wallet has nothing
   * to guess about.
   */
  readonly icon?: ComponentType<{ className?: string }> | undefined

  /**
   * Accessible name when the visible label is not enough to tell
   * options apart.
   *
   * Needed where a short label repeats in a neighboring set: two
   * buttons named “All” are indistinguishable to someone who hears
   * the page rather than looks at it.
   */
  readonly name?: string | undefined

  /**
   * Shown in the set but not selectable.
   *
   * Used when a tab must stay visible so the layout does not jump,
   * while the view behind it is not available yet.
   */
  readonly disabled?: boolean | undefined
}

export interface SegmentedControlProps<TValue extends string | number> {
  readonly options: readonly ISegmentedOption<TValue>[]
  readonly value: TValue
  readonly onChange: (value: TValue) => void

  /**
   * Visible name of the set.
   *
   * Required, not optional. A button set with no name forces
   * guessing what it controls, and guessing in a wallet ends in
   * the wrong speed or the wrong filter.
   */
  readonly legend: string

  /**
   * Compact set for dense admin rows. Default stays 44px for
   * phone filters and send speed.
   */
  readonly size?: 'default' | 'sm' | undefined

  /**
   * Keep the legend for assistive tech but hide it on screen
   * when a nearby label already names the set.
   */
  readonly hideLegend?: boolean | undefined

  readonly className?: string | undefined
}

/**
 * Choose one value from a set.
 *
 * A SHARED PRIMITIVE, NOT A COPY ON EACH SCREEN. This switch
 * appeared independently on history filters and on send speed,
 * and the sets were already drifting — different height, different
 * selected look. Controls that mean the same thing but look
 * different read as different in purpose.
 *
 * THE SELECTION IS MARKED THREE WAYS AT ONCE: color, elevation,
 * and `aria-pressed`. Color as the only cue is unavailable to
 * people with impaired color vision and is not read by assistive
 * technology.
 *
 * HEIGHT 44 PIXELS — the lower bound for a finger tap. Both
 * filters and send speed are pressed on a phone at least as often
 * as with a mouse.
 */
export function SegmentedControl<TValue extends string | number>({
  options,
  value,
  onChange,
  legend,
  size = 'default',
  hideLegend = false,
  className,
}: SegmentedControlProps<TValue>) {
  const compact = size === 'sm'

  return (
    <fieldset className={className}>
      <legend
        className={cn(
          'mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase',
          hideLegend && 'sr-only',
        )}
      >
        {legend}
      </legend>

      {/* Shared track under the whole set. Without it the buttons
          read as separate actions, not as choosing one value from
          a row. */}
      <div
        className={cn(
          'grid bg-muted/60',
          compact ? 'gap-0.5 rounded-md p-0.5' : 'gap-1 rounded-xl p-1',
        )}
        style={{ gridTemplateColumns: `repeat(${String(options.length)}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const isSelected = option.value === value
          const isDisabled = option.disabled === true
          const Icon = option.icon

          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={isSelected}
              aria-label={option.name}
              disabled={isDisabled}
              onClick={() => {
                if (isDisabled) {
                  return
                }

                onChange(option.value)
              }}
              className={cn(
                /* No borders: inside the track they would draw a
                   second grid on top of the first. */
                'focus-ring flex items-center justify-center truncate font-medium transition-all',
                compact
                  ? 'min-h-7 gap-1 rounded-sm px-1.5 text-[11px]'
                  : 'min-h-11 gap-1.5 rounded-lg px-2 text-xs',
                isDisabled
                  ? 'cursor-not-allowed opacity-50'
                  : 'cursor-pointer',
                isSelected
                  ? 'bg-primary/15 text-primary-emphasis shadow-surface'
                  : isDisabled
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {Icon === undefined ? null : <Icon className="size-4 shrink-0" />}
              <span className="truncate">{option.label}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
