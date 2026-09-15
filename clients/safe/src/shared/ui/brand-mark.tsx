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
 * THE METAL STUDY IS THE MARK. Dark rounded tile, steel chrome
 * shield, keyhole cut — the same lockup as Safe · Metal on
 * `/logo-variants`. It is one file in light and dark: the tile
 * already carries its own ground, so a white invert would erase it.
 *
 * FILE SIZE. The source is 1024×1024. This uses the prepared 128×128
 * from `npm run icons` / `brand/icon-dark.png`.
 *
 * THE MARK HELPS AGAINST PHISHING. A recognizable look is a weak but
 * real barrier to a fake copy: a user used to a specific mark notices
 * a swap. So it is the same on every screen and is not replaced by
 * arbitrary icons.
 */
export function BrandMark({ className, alt = APP_CONFIG.name }: BrandMarkProps) {
  return (
    <img
      src="/icons/icon-128.png"
      width={INTRINSIC_SIZE}
      height={INTRINSIC_SIZE}
      alt={alt}
      loading="eager"
      decoding="async"
      draggable={false}
      className={cn('size-8 select-none', className)}
    />
  )
}
