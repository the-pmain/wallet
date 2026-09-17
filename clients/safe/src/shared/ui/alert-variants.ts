import { cva } from 'class-variance-authority'

/**
 * Alert appearance variants.
 *
 * Extracted from the component: React Fast Refresh works correctly
 * only when a module exports components alone.
 *
 * Levels match the risk colors from the design tokens and are used
 * the same way across the app: the user must tell a note from a
 * warning about an irreversible action at a glance, without reading
 * the text.
 */
export const alertVariants = cva(
  'relative grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-lg border px-3 py-3 text-sm sm:px-4 [&>svg]:size-4 [&>svg]:translate-y-0.5',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        /** Recoverable trouble: bad input, an unreachable network. */
        warning: 'border-risk-medium/40 bg-risk-medium/10 text-foreground [&>svg]:text-risk-medium',
        /** Irreversible action or loss of access to funds. */
        danger: 'border-destructive/40 bg-destructive/10 text-foreground [&>svg]:text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)
