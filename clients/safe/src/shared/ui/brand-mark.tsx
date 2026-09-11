import { APP_CONFIG } from '@/shared/config'
import { cn } from '@/shared/lib/utils'

interface BrandMarkProps {
  readonly className?: string
  /**
   * Caption for the mark. An empty string means the mark is decorative:
   * a visible name already sits beside it, and repeating “ELM” in
   * a screen reader would be noise.
   */
  readonly alt?: string
}

/**
 * Intrinsic size of the source file in pixels.
 *
 * Set on `width` and `height` so the browser reserves space before the
 * image loads. Without that the screen jumps when the mark appears.
 */
const INTRINSIC_SIZE = 128

/**
 * ELM brand mark.
 *
 * THE MARK WITHOUT LETTERING IS USED. The full logo lockup contains
 * the word “Wallet” in dark blue (rgb 50, 54, 75). On the dark theme
 * (rgb 38, 33, 48) it is nearly invisible, so the full lockup is only
 * fit for light surfaces — a storefront, documents, print.
 *
 * BLACK IN THE CHROME, WHITE ONLY IN THE DARK APP. The purple cube
 * belongs to ETX. Safe ships a black mark for tabs and home-screen
 * tiles (`/icons/icon-128.png`) and a white paint of the same shape
 * (`/icons/icon-white-128.png`) for the in-app mark on a dark canvas.
 *
 * FILE SIZE. The source mark is 1024×1024 and about 1.4 MB. This uses
 * a prepared 128×128 variant: downloading a megabyte and a half for a
 * 56-pixel square is not acceptable. Size variants are produced by
 * `npm run icons` from `brand/icon-dark.png`.
 *
 * THE MARK HELPS AGAINST PHISHING. A recognizable look is a weak but
 * real barrier to a fake copy: a user used to a specific mark notices
 * a swap. So it is the same on every screen and is not replaced by
 * arbitrary icons.
 */
export function BrandMark({ className, alt = APP_CONFIG.name }: BrandMarkProps) {
  const decorative = alt === ''

  return (
    <span
      className={cn('inline-flex size-8', className)}
      {...(decorative ? {} : { role: 'img', 'aria-label': alt })}
    >
      <img
        src="/icons/icon-128.png"
        width={INTRINSIC_SIZE}
        height={INTRINSIC_SIZE}
        alt=""
        loading="eager"
        decoding="async"
        draggable={false}
        className="size-full select-none dark:hidden"
      />
      <img
        src="/icons/icon-white-128.png"
        width={INTRINSIC_SIZE}
        height={INTRINSIC_SIZE}
        alt=""
        loading="eager"
        decoding="async"
        draggable={false}
        className="hidden size-full select-none dark:block"
      />
    </span>
  )
}
