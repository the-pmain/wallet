import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { THEME_IDS, THEMES } from './themes'

const repositoryRoot = process.cwd()

function clientPaths(theme: (typeof THEME_IDS)[number]) {
  const root = resolve(repositoryRoot, THEMES[theme].root)

  return {
    root,
    html: resolve(root, 'index.html'),
    publicDir: resolve(root, 'public'),
    manifest: resolve(root, 'public/manifest.webmanifest'),
  }
}

function publicFile(theme: (typeof THEME_IDS)[number], href: string): string {
  const path = href.split('?')[0] ?? href

  return resolve(clientPaths(theme).publicDir, path.replace(/^\//u, ''))
}

function hrefs(html: string, rel: string): string[] {
  return [...html.matchAll(new RegExp(`<link\\s+[^>]*rel="${rel}"[^>]*>`, 'gu'))].map((match) => {
    const href = /href="([^"]+)"/u.exec(match[0] ?? '')?.[1]

    expect(href, `${rel} is missing href`).toEqual(expect.any(String))

    return href as string
  })
}

function metaContent(html: string, name: string): string {
  const value = new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]+)"`, 'u').exec(html)?.[1]

  expect(value, `${name} is missing`).toEqual(expect.any(String))

  return value as string
}

describe('home-screen icons', () => {
  it('every registered client ships a 180 Apple touch icon and a standalone manifest', async () => {
    for (const theme of THEME_IDS) {
      const paths = clientPaths(theme)
      const html = readFileSync(paths.html, 'utf8')
      const manifest = JSON.parse(readFileSync(paths.manifest, 'utf8')) as {
        name?: string
        display?: string
        icons?: readonly { src?: string; sizes?: string; purpose?: string }[]
      }

      expect(html).toContain('rel="apple-touch-icon" sizes="180x180"')
      expect(html).toContain('name="apple-mobile-web-app-capable"')
      expect(html).toContain('name="mobile-web-app-capable"')
      expect(html).toContain('rel="icon" type="image/png" sizes="32x32"')
      expect(html).toContain('rel="icon" type="image/png" sizes="16x16"')
      expect(html).toContain('property="og:image"')
      expect(html).toContain('name="twitter:image"')
      expect(html).toContain('name="robots"')

      const apple = hrefs(html, 'apple-touch-icon')
      const manifestLinks = hrefs(html, 'manifest')

      expect(apple).toHaveLength(1)
      expect(manifestLinks).toEqual(['/manifest.webmanifest'])
      expect(manifest.name).toBe(metaContent(html, 'application-name'))
      expect(manifest.display).toBe('standalone')

      const iconHrefs = [
        ...hrefs(html, 'icon'),
        ...apple,
        ...manifestLinks,
        ...(manifest.icons ?? []).map((icon) => icon.src ?? ''),
        /content="(\/icons\/[^"]+)"/u.exec(html)?.[1] ?? '',
      ].filter((href) => href.startsWith('/'))

      for (const href of iconHrefs) {
        expect(existsSync(publicFile(theme, href)), `${theme} missing ${href}`).toBe(true)
      }

      const appleMeta = await sharp(publicFile(theme, apple[0] as string)).metadata()

      expect(appleMeta.width).toBe(180)
      expect(appleMeta.height).toBe(180)
      expect(appleMeta.format).toBe('png')

      const any192 = manifest.icons?.find((icon) => icon.sizes === '192x192')
      const any512 = manifest.icons?.find(
        (icon) => icon.sizes === '512x512' && (icon.purpose ?? 'any').includes('any'),
      )
      const maskable = manifest.icons?.find((icon) => (icon.purpose ?? '').includes('maskable'))

      expect(any192?.src).toBe('/icons/icon-192.png')
      expect(any512?.src).toBe('/icons/icon-512.png')
      expect(maskable?.src).toBe('/icons/icon-maskable-512.png')
      expect(maskable?.sizes).toBe('512x512')

      const sized = [
        [any192?.src, 192],
        [any512?.src, 512],
        [maskable?.src, 512],
      ] as const

      for (const [src, size] of sized) {
        const meta = await sharp(publicFile(theme, src as string)).metadata()

        expect(meta.width).toBe(size)
        expect(meta.height).toBe(size)
        expect(meta.format).toBe('png')
      }
    }
  })

  it('the purple cube is the ETX source and is not used for Safe', () => {
    expect(existsSync(resolve(clientPaths('etx').root, 'brand/icon-purple.png'))).toBe(true)
    expect(existsSync(resolve(clientPaths('etx').root, 'brand/icon.png'))).toBe(false)
    expect(existsSync(resolve(clientPaths('safe').root, 'brand/icon-dark.png'))).toBe(true)
    expect(existsSync(resolve(clientPaths('safe').root, 'brand/icon.png'))).toBe(false)
    expect(existsSync(resolve(clientPaths('safe').root, 'brand/icon-purple.png'))).toBe(false)
    expect(existsSync(publicFile('etx', '/icons/icon-white-32.png'))).toBe(false)
    expect(existsSync(publicFile('safe', '/icons/icon-white-32.png'))).toBe(false)
    expect(existsSync(publicFile('safe', '/icons/icon-white-128.png'))).toBe(true)
    expect(readFileSync(clientPaths('safe').html, 'utf8')).not.toMatch(/icon-white-/u)
  })

  it('ETX tab icons keep the purple mark', async () => {
    const pixels = await opaquePixels('etx', '/icons/icon-32.png')

    expect(maxChannelSpread(pixels), 'etx icon-32 lost its purple').toBeGreaterThan(40)
  })

  it('Safe tab and home-screen icons stay the black mark', async () => {
    const html = readFileSync(clientPaths('safe').html, 'utf8')
    const dark = await opaquePixels('safe', '/icons/icon-32.png')
    const apple = await opaquePixels('safe', '/icons/icon-180.png')
    const maskable = await opaquePixels('safe', '/icons/icon-maskable-512.png')

    expect(html).not.toMatch(/icon-white-/u)
    expect(html).not.toMatch(/rel="icon"[^>]*prefers-color-scheme/u)
    expect(maxChannelSpread(dark), 'safe icon-32 is still tinted').toBeLessThan(12)
    expect(meanLuminance(dark), 'safe icon-32 is not black').toBeLessThan(40)
    expect(apple.some(([red]) => red < 40), 'safe apple icon has no black mark').toBe(true)
    expect(apple.some(([red]) => red > 230), 'safe apple icon has no light tile').toBe(true)
    expect(maskable.some(([red]) => red < 40), 'safe maskable icon has no black mark').toBe(true)
    expect(maskable.some(([red]) => red > 230), 'safe maskable icon has no light tile').toBe(true)
  })
})

async function opaquePixels(
  theme: (typeof THEME_IDS)[number],
  href: string,
): Promise<readonly (readonly [number, number, number])[]> {
  const { data } = await sharp(publicFile(theme, href)).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  })
  const pixels: Array<readonly [number, number, number]> = []

  for (let index = 0; index < data.length; index += 4) {
    if ((data[index + 3] ?? 0) < 200) {
      continue
    }

    pixels.push([data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0])
  }

  return pixels
}

function maxChannelSpread(pixels: readonly (readonly [number, number, number])[]): number {
  let max = 0

  for (const [red, green, blue] of pixels) {
    max = Math.max(max, Math.max(red, green, blue) - Math.min(red, green, blue))
  }

  return max
}

function meanLuminance(pixels: readonly (readonly [number, number, number])[]): number {
  if (pixels.length === 0) {
    return 0
  }

  let sum = 0

  for (const [red, green, blue] of pixels) {
    sum += 0.299 * red + 0.587 * green + 0.114 * blue
  }

  return sum / pixels.length
}
