import { cva } from 'class-variance-authority'

/**
 * Badge appearance variants.
 *
 * Extracted from the component: React Fast Refresh works correctly
 * only when a module exports components alone.
 *
 * The set follows the semantic levels of the palette. Success is the
 * same green as low risk; there is no decorative color.
 */
export const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/10 text-primary-emphasis',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-muted-foreground',
        success: 'border-risk-low/40 bg-risk-low/20 text-risk-low',
        warning: 'border-transparent bg-risk-medium/15 text-risk-medium',
        danger: 'border-transparent bg-destructive/15 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)
