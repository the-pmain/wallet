import { writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

/**
 * Writes the Metal study as each theme’s 1024 source: dark rounded
 * tile, chrome shield, keyhole cut. Same numbers as logo-lockups.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const SHIELD = 'M50 8L86 22V50C86 74 50 92 50 92C50 92 14 74 14 50V22Z'
const KEYHOLE = 'M50 70.68L43.744 45.84A9.2 9.2 0 1 1 56.256 45.84Z'

/** `rounded-[1.7rem]` on `size-28` (112px). */
const TILE_RADIUS = 24.286
/** `p-3` on `size-28`. */
const TILE_PAD = 10.714

function metalTileSvg({ from, to, stops }) {
  const inner = 100 - TILE_PAD * 2
  const stopMarkup = stops
    .map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`)
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="tile" x1="33" y1="3" x2="67" y2="97" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <linearGradient id="chrome" x1="16" y1="12" x2="88" y2="88" gradientUnits="userSpaceOnUse">
      ${stopMarkup}
    </linearGradient>
    <mask id="cut" maskUnits="userSpaceOnUse">
      <path fill="#ffffff" fill-rule="evenodd" d="${SHIELD}${KEYHOLE}"/>
    </mask>
  </defs>
  <rect width="100" height="100" rx="${TILE_RADIUS}" fill="url(#tile)"/>
  <path d="M${TILE_RADIUS} 0.7 H${100 - TILE_RADIUS}" stroke="#ffffff" stroke-opacity="0.14" stroke-width="1.2"/>
  <g transform="translate(${TILE_PAD} ${TILE_PAD}) scale(${inner / 100})">
    <g mask="url(#cut)">
      <path d="${SHIELD}" fill="url(#chrome)"/>
      <path d="M50 8L78 20L50 36L24 20Z" fill="#ffffff" opacity="0.22"/>
      <path d="${SHIELD}" fill="none" stroke="#ffffff" stroke-width="1.1" opacity="0.35"/>
    </g>
  </g>
</svg>`
}

async function writePng(svg, output) {
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()

  await writeFile(output, png)
  console.log(`${output} — ${String(Math.round(png.byteLength / 102.4) / 10)} KB`)
}

await writePng(
  metalTileSvg({
    from: '#1C1440',
    to: '#0A0816',
    stops: [
      ['0', '#F4EFFF'],
      ['0.22', '#B9A4FF'],
      ['0.45', '#7C5CFF'],
      ['0.7', '#3D2A9E'],
      ['1', '#C4B5FF'],
    ],
  }),
  resolve(ROOT, 'clients/etx/brand/icon-purple.png'),
)

await writePng(
  metalTileSvg({
    from: '#1A1A1A',
    to: '#050505',
    stops: [
      ['0', '#FFFFFF'],
      ['0.2', '#C8C8C8'],
      ['0.42', '#F2F2F2'],
      ['0.68', '#6E6E6E'],
      ['1', '#E8E8E8'],
    ],
  }),
  resolve(ROOT, 'clients/safe/brand/icon-dark.png'),
)
