import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'
import { loadEnv } from 'vite'

/**
 * Prepare app icons from the source logo.
 *
 * WHY. The source is 1024×1024 and about 1.4 MB. That size is right for
 * print and an extension-store listing, but not for a tab icon or a UI
 * element: the browser would download a megabyte and a half to paint a
 * 56-pixel square.
 *
 * SECOND REASON — the extension. Manifest v3 wants 16, 32, 48 and 128
 * pixel icons as separate files. Preparing them by hand means one of
 * them will eventually be forgotten when the logo changes.
 *
 * EXTRA MARGIN IS TRIMMED. In the source the mark fills about half the
 * canvas; the rest is transparent padding. At 16 pixels the mark would
 * become an unreadable dot in the centre. `trim` drops the transparent
 * edges so the mark fills the frame.
 *
 * HOME SCREEN. iOS wants 180×180 (`apple-touch-icon`). Android / the
 * web app manifest want 192 and 512, plus a maskable 512 whose mark
 * sits in the inner 80% so adaptive-icon masks do not clip it.
 *
 * COLOUR. Both sources are the Metal study: a dark rounded tile
 * with a chrome shield. ETX is violet (`brand/icon-purple.png`).
 * Safe is steel (`brand/icon-dark.png`). The tile is the mark, so
 * it is the same in the app, the tab, and the home-screen icon.
 * Safe does not invert to white: steel on charcoal already reads
 * on a light or dark canvas.
 *
 * Run: `npm run icons`. Output lands in `public/` and in version
 * control: the build must not depend on `sharp` being present.
 *
 * `node scripts/generate-icons.mjs --home-screen` writes only the
 * Apple-touch and maskable files so a logo-pipeline change does not
 * rewrite every tab icon.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const environment = loadEnv(process.env.NODE_ENV ?? 'development', ROOT, '')
const themeDefinitions = JSON.parse(
  await readFile(resolve(ROOT, 'build/themes.json'), { encoding: 'utf8' }),
)
const theme = process.env.THEME ?? environment.THEME

if (typeof theme !== 'string' || !Object.hasOwn(themeDefinitions, theme)) {
  throw new Error(
    `THEME must be one of: ${Object.keys(themeDefinitions).join(', ')}. Received: ${JSON.stringify(theme ?? '')}.`,
  )
}

const CLIENT_ROOT = resolve(ROOT, themeDefinitions[theme].root)
const HOME_SCREEN_ONLY = process.argv.includes('--home-screen')

/**
 * Required sizes.
 *
 * 16, 32, 48, 128 — the Manifest v3 set. 192 and 512 — for installing
 * the web app on a home screen. 180 is the Apple touch icon, written
 * separately onto the theme background.
 */
const SIZES = [16, 32, 48, 128, 192, 512]
const APPLE_TOUCH_SIZE = 180
const MASKABLE_SIZE = 512

/**
 * Padding around the mark as a fraction of the side.
 *
 * Without it the mark hits the edges and is clipped at the corners on
 * the OS round masks. Maskable icons need a wider safe zone: Android
 * may crop to a circle whose diameter is 80% of the canvas.
 */
const PADDING_RATIO = 0.03
const MASKABLE_PADDING_RATIO = 0.2

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }

/**
 * Per-theme source and paint.
 *
 * The source already is the dark rounded tile. Tab icons keep that
 * tile on transparency. Home-screen squares use the tile’s own dark
 * so iOS does not fill the rounded corners with white.
 */
const THEME_ICON = {
  etx: {
    source: 'brand/icon-purple.png',
    inAppWhite: false,
    background: { r: 10, g: 8, b: 22, alpha: 1 },
  },
  safe: {
    source: 'brand/icon-dark.png',
    inAppWhite: false,
    background: { r: 5, g: 5, b: 5, alpha: 1 },
  },
}

const iconTheme = THEME_ICON[theme]

if (iconTheme === undefined) {
  throw new Error(`No icon paint rules for theme ${theme}.`)
}

/**
 * Keeps the mark's shape and paints every visible pixel white.
 *
 * Hue-rotate on a coloured file leaves a tinted leftover in the
 * favicon, which CSS cannot recolor. RGB is replaced; alpha stays,
 * so anti-aliased edges remain.
 */
async function toWhite(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  })

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) {
      continue
    }

    data[index] = 255
    data[index + 1] = 255
    data[index + 2] = 255
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer()
}

async function writeIcon({ mark, outputDirectory, size, paddingRatio, background, filename }) {
  const inner = Math.round(size * (1 - paddingRatio * 2))
  const icon = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([
      {
        input: await sharp(mark)
          .resize(inner, inner, { fit: 'contain', background: TRANSPARENT })
          .toBuffer(),
        gravity: 'center',
      },
    ])
    .png({ compressionLevel: 9, palette: size <= 48 })
    .toBuffer()

  await writeFile(resolve(outputDirectory, filename), icon)
  console.log(`${filename} — ${String(Math.round(icon.byteLength / 102.4) / 10)} KB`)
}

async function main() {
  const source = await readFile(resolve(CLIENT_ROOT, iconTheme.source))
  const mark = await sharp(source).trim({ threshold: 10 }).png().toBuffer()
  const outputDirectory = resolve(CLIENT_ROOT, 'public/icons')

  await mkdir(outputDirectory, { recursive: true })

  if (!HOME_SCREEN_ONLY) {
    for (const size of SIZES) {
      await writeIcon({
        mark,
        outputDirectory,
        size,
        paddingRatio: PADDING_RATIO,
        background: TRANSPARENT,
        filename: `icon-${String(size)}.png`,
      })
    }

    if (iconTheme.inAppWhite) {
      await writeIcon({
        mark: await toWhite(mark),
        outputDirectory,
        size: 128,
        paddingRatio: PADDING_RATIO,
        background: TRANSPARENT,
        filename: 'icon-white-128.png',
      })
    }
  }

  await writeIcon({
    mark,
    outputDirectory,
    size: APPLE_TOUCH_SIZE,
    paddingRatio: PADDING_RATIO,
    background: iconTheme.background,
    filename: `icon-${String(APPLE_TOUCH_SIZE)}.png`,
  })

  await writeIcon({
    mark,
    outputDirectory,
    size: MASKABLE_SIZE,
    paddingRatio: MASKABLE_PADDING_RATIO,
    background: iconTheme.background,
    filename: `icon-maskable-${String(MASKABLE_SIZE)}.png`,
  })
}

await main()
