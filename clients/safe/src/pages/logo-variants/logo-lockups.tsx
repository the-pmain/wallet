import type { ReactNode } from 'react'

/**
 * One shield. Five materials. A flat white cutout does not count.
 *
 * ETX is amethyst. Safe is obsidian and steel.
 */

export const ETX_VIOLET = '#7C5CFF'
export const SAFE_INK = '#111111'

export interface ILogoStudy {
  readonly id: string
  readonly brand: 'ETX' | 'Safe'
  readonly name: string
  readonly thesis: string
  readonly lockup: ReactNode
}

const SHIELD = 'M50 8L86 22V50C86 74 50 92 50 92C50 92 14 74 14 50V22Z'

function keyhole(): string {
  const cx = 50
  const cy = 44
  const r = 9.2
  const w = r * 0.68
  const drop = r * 1.9

  return `M${cx} ${cy + r + drop}L${cx - w} ${cy + r * 0.2}A${r} ${r} 0 1 1 ${cx + w} ${cy + r * 0.2}Z`
}

function ShieldClip({
  uid,
  defs,
  children,
}: {
  readonly uid: string
  readonly defs?: ReactNode
  readonly children: ReactNode
}) {
  return (
    <svg viewBox="0 0 100 100" className="size-full" aria-hidden>
      <defs>
        <clipPath id={`${uid}-clip`} clipRule="evenodd">
          <path d={`${SHIELD}${keyhole()}`} />
        </clipPath>
        {defs}
      </defs>
      <g
        clipPath={`url(#${uid}-clip)`}
        clipRule="evenodd"
        style={{ filter: 'drop-shadow(0 5px 10px rgb(0 0 0 / 32%))' }}
      >
        {children}
      </g>
    </svg>
  )
}

function Tile({
  background,
  children,
}: {
  readonly background: string
  readonly children: ReactNode
}) {
  return (
    <span
      className="flex size-28 items-center justify-center rounded-[1.7rem] p-3"
      style={{
        background,
        boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 14%), 0 10px 22px rgb(0 0 0 / 22%)',
      }}
    >
      {children}
    </span>
  )
}

function MarkGradient({ uid, from, mid, to }: { readonly uid: string; readonly from: string; readonly mid: string; readonly to: string }) {
  return (
    <ShieldClip
      uid={uid}
      defs={
        <>
          <linearGradient id={`${uid}-g`} x1="18" y1="10" x2="86" y2="92" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={from} />
            <stop offset="0.48" stopColor={mid} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
          <radialGradient id={`${uid}-h`} cx="34" cy="26" r="42" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </>
      }
    >
      <path d={SHIELD} fill={`url(#${uid}-g)`} />
      <path d={SHIELD} fill={`url(#${uid}-h)`} />
    </ShieldClip>
  )
}

function MarkCrystal({
  uid,
  light,
  mid,
  deep,
}: {
  readonly uid: string
  readonly light: string
  readonly mid: string
  readonly deep: string
}) {
  return (
    <ShieldClip
      uid={uid}
      defs={
        <linearGradient id={`${uid}-edge`} x1="50" y1="8" x2="50" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      }
    >
      <path d="M50 8L86 22L50 40L14 22Z" fill={light} />
      <path d="M14 22L50 40L50 92L14 50Z" fill={mid} />
      <path d="M86 22L86 50L50 92L50 40Z" fill={deep} />
      <path d="M50 8L86 22L50 40Z" fill="#ffffff" opacity="0.28" />
      <path d="M50 8L14 22 50 40" fill="#ffffff" opacity="0.12" />
      <path d={SHIELD} fill="none" stroke={`url(#${uid}-edge)`} strokeWidth="1.4" />
    </ShieldClip>
  )
}

function MarkGlass({
  uid,
  body,
  depth,
}: {
  readonly uid: string
  readonly body: string
  readonly depth: string
}) {
  return (
    <ShieldClip
      uid={uid}
      defs={
        <>
          <linearGradient id={`${uid}-body`} x1="28" y1="8" x2="72" y2="92" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.82" />
            <stop offset="0.38" stopColor={body} stopOpacity="0.72" />
            <stop offset="1" stopColor={depth} stopOpacity="0.92" />
          </linearGradient>
          <radialGradient id={`${uid}-glow`} cx="38" cy="28" r="36" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.7" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </>
      }
    >
      <path d={SHIELD} fill={`url(#${uid}-body)`} />
      <path d={SHIELD} fill={`url(#${uid}-glow)`} />
      <ellipse cx="38" cy="26" rx="16" ry="7" transform="rotate(-22 38 26)" fill="#ffffff" opacity="0.55" />
      <path
        d="M32 20C42 16 62 16 70 22C66 30 58 34 50 34C40 34 34 28 32 20Z"
        fill="#ffffff"
        opacity="0.22"
      />
      <path d={SHIELD} fill="none" stroke="#ffffff" strokeWidth="1.6" opacity="0.45" />
    </ShieldClip>
  )
}

function MarkGloss({ uid, body, shade }: { readonly uid: string; readonly body: string; readonly shade: string }) {
  return (
    <ShieldClip
      uid={uid}
      defs={
        <linearGradient id={`${uid}-body`} x1="50" y1="8" x2="50" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={body} />
          <stop offset="1" stopColor={shade} />
        </linearGradient>
      }
    >
      <path d={SHIELD} fill={`url(#${uid}-body)`} />
      <ellipse cx="40" cy="24" rx="22" ry="9" transform="rotate(-18 40 24)" fill="#ffffff" opacity="0.42" />
      <path d="M22 30C30 22 44 18 50 18C56 18 62 20 68 26" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.35" />
      <path d={SHIELD} fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.28" />
    </ShieldClip>
  )
}

function MarkMetal({
  uid,
  stops,
}: {
  readonly uid: string
  readonly stops: readonly { readonly offset: string; readonly color: string }[]
}) {
  return (
    <ShieldClip
      uid={uid}
      defs={
        <linearGradient id={`${uid}-m`} x1="16" y1="12" x2="88" y2="88" gradientUnits="userSpaceOnUse">
          {stops.map((stop) => (
            <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
          ))}
        </linearGradient>
      }
    >
      <path d={SHIELD} fill={`url(#${uid}-m)`} />
      <path d="M50 8L78 20L50 36L24 20Z" fill="#ffffff" opacity="0.22" />
      <path d={SHIELD} fill="none" stroke="#ffffff" strokeWidth="1.1" opacity="0.35" />
    </ShieldClip>
  )
}

const ETX_CHROME = [
  { offset: '0', color: '#F4EFFF' },
  { offset: '0.22', color: '#B9A4FF' },
  { offset: '0.45', color: '#7C5CFF' },
  { offset: '0.7', color: '#3D2A9E' },
  { offset: '1', color: '#C4B5FF' },
] as const

const SAFE_CHROME = [
  { offset: '0', color: '#FFFFFF' },
  { offset: '0.2', color: '#C8C8C8' },
  { offset: '0.42', color: '#F2F2F2' },
  { offset: '0.68', color: '#6E6E6E' },
  { offset: '1', color: '#E8E8E8' },
] as const

export const LOGO_STUDIES: readonly ILogoStudy[] = [
  {
    id: 'etx-gradient',
    brand: 'ETX',
    name: 'ETX · Gradient',
    thesis: 'The same shield. A violet sweep instead of flat white.',
    lockup: (
      <Tile background="linear-gradient(160deg, #2A1F66 0%, #16102E 100%)">
        <MarkGradient uid="etx-gradient" from="#EDE4FF" mid={ETX_VIOLET} to="#2F1D86" />
      </Tile>
    ),
  },
  {
    id: 'etx-crystal',
    brand: 'ETX',
    name: 'ETX · Crystal',
    thesis: 'Amethyst facets. Light hits three planes, not one fill.',
    lockup: (
      <Tile background="linear-gradient(160deg, #1A1238 0%, #0C081C 100%)">
        <MarkCrystal uid="etx-crystal" light="#D9CBFF" mid={ETX_VIOLET} deep="#2C1A7A" />
      </Tile>
    ),
  },
  {
    id: 'etx-glass',
    brand: 'ETX',
    name: 'ETX · Glass',
    thesis: 'Liquid glass. Specular blob, rim, and a caustic down the face.',
    lockup: (
      <Tile background="linear-gradient(160deg, #3A2A7A 0%, #1A1238 100%)">
        <MarkGlass uid="etx-glass" body={ETX_VIOLET} depth="#24145C" />
      </Tile>
    ),
  },
  {
    id: 'etx-gloss',
    brand: 'ETX',
    name: 'ETX · Gloss',
    thesis: 'Wet enamel. One highlight, then the color drops.',
    lockup: (
      <Tile background="linear-gradient(160deg, #2A1F66 0%, #120C28 100%)">
        <MarkGloss uid="etx-gloss" body="#9B82FF" shade="#3A2490" />
      </Tile>
    ),
  },
  {
    id: 'etx-metal',
    brand: 'ETX',
    name: 'ETX · Metal',
    thesis: 'Violet chrome. Hard stops, like a polished plate.',
    lockup: (
      <Tile background="linear-gradient(160deg, #1C1440 0%, #0A0816 100%)">
        <MarkMetal uid="etx-metal" stops={ETX_CHROME} />
      </Tile>
    ),
  },
  {
    id: 'safe-gradient',
    brand: 'Safe',
    name: 'Safe · Gradient',
    thesis: 'The same shield. Steel sweep on charcoal, not flat white.',
    lockup: (
      <Tile background="linear-gradient(160deg, #2A2A2A 0%, #0A0A0A 100%)">
        <MarkGradient uid="safe-gradient" from="#F5F5F5" mid="#8A8A8A" to="#1C1C1C" />
      </Tile>
    ),
  },
  {
    id: 'safe-crystal',
    brand: 'Safe',
    name: 'Safe · Crystal',
    thesis: 'Smoky quartz. Three planes, ice on the crown.',
    lockup: (
      <Tile background="linear-gradient(160deg, #1A1A1A 0%, #050505 100%)">
        <MarkCrystal uid="safe-crystal" light="#E8E8E8" mid="#8A8A8A" deep="#2A2A2A" />
      </Tile>
    ),
  },
  {
    id: 'safe-glass',
    brand: 'Safe',
    name: 'Safe · Glass',
    thesis: 'Dark liquid glass. Ice rim on an obsidian body.',
    lockup: (
      <Tile background="linear-gradient(160deg, #2C2C2C 0%, #0A0A0A 100%)">
        <MarkGlass uid="safe-glass" body="#6E6E6E" depth="#141414" />
      </Tile>
    ),
  },
  {
    id: 'safe-gloss',
    brand: 'Safe',
    name: 'Safe · Gloss',
    thesis: 'Black enamel. One wet highlight.',
    lockup: (
      <Tile background="linear-gradient(160deg, #222222 0%, #080808 100%)">
        <MarkGloss uid="safe-gloss" body="#7A7A7A" shade="#1C1C1C" />
      </Tile>
    ),
  },
  {
    id: 'safe-metal',
    brand: 'Safe',
    name: 'Safe · Metal',
    thesis: 'Brushed steel. Hard chrome stops.',
    lockup: (
      <Tile background="linear-gradient(160deg, #1A1A1A 0%, #050505 100%)">
        <MarkMetal uid="safe-metal" stops={SAFE_CHROME} />
      </Tile>
    ),
  },
]
