import { APP_CONFIG } from '@/shared/config'
import { cn } from '@/shared/lib/utils'

interface BrandWordmarkProps {
  readonly className?: string
}

/**
 * Имя продукта рядом со знаком.
 *
 * Space Grotesk только здесь — геометрический гротеск острее Inter,
 * без округлости Rubik у соседней темы. Кабинет остаётся Inter.
 */
export function BrandWordmark({ className }: BrandWordmarkProps) {
  return (
    <span
      className={cn(
        'font-display text-[1.2rem] font-bold tracking-[0.04em] whitespace-nowrap text-foreground',
        className,
      )}
    >
      {APP_CONFIG.brandLabel}
    </span>
  )
}
