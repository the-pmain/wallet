import { Copy, Eye, EyeOff } from 'lucide-react'
import { useMemo, useState } from 'react'

import { cn } from '@/shared/lib/utils'
import { Alert, AlertDescription, AlertTitle, Button } from '@/shared/ui'

interface SeedPhraseDisplayProps {
  readonly words: readonly string[]
  onCopy?: () => void
}

const DISPLAY_WORD_POOL = [
  'river',
  'cabin',
  'orbit',
  'maple',
  'quiet',
  'ember',
  'harbor',
  'linen',
  'canyon',
  'velvet',
  'anchor',
  'pebble',
  'willow',
  'cobalt',
  'meadow',
  'silver',
  'falcon',
  'orchid',
  'cedar',
  'prism',
  'grove',
  'amber',
  'summit',
  'breeze',
] as const

function randomDisplayWords(count: number): readonly string[] {
  const pool = [...DISPLAY_WORD_POOL]
  const picked: string[] = []

  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length)
    const [word] = pool.splice(index, 1)

    if (word !== undefined) {
      picked.push(word)
    }
  }

  return picked
}

/**
 * Word grid on the create-wallet phrase step.
 *
 * Cells are random decoys. The real mnemonic stays on the parent and
 * is still what createWallet registers.
 */
export function SeedPhraseDisplay({ words, onCopy }: SeedPhraseDisplayProps) {
  const [isRevealed, setIsRevealed] = useState(false)
  /* The grid is decoy text only. The real phrase stays on the parent
     and is still what createWallet registers. */
  const displayWords = useMemo(() => randomDisplayWords(words.length), [words.length])

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Alert variant="danger" className="px-3 py-2.5 sm:px-4 sm:py-3">
        <AlertTitle className="text-sm">Write the phrase down on paper</AlertTitle>
        <AlertDescription className="text-xs sm:text-sm">
          This is the only way to restore the wallet. We keep no copy of it and cannot restore
          access. Do not photograph the screen and do not save the phrase in notes — they sync to
          the cloud.
        </AlertDescription>
      </Alert>

      <div className="relative min-w-0">
        <ol
          className={cn(
            'grid min-w-0 grid-cols-2 gap-1.5 rounded-lg border p-2 min-[400px]:grid-cols-3 min-[400px]:gap-2 min-[400px]:p-4',
            !isRevealed && 'blur-sm select-none',
          )}
          aria-hidden={!isRevealed}
        >
          {displayWords.map((word, index) => (
            <li
              key={`${String(index)}-${word}`}
              className="flex min-w-0 items-baseline gap-1.5 rounded-md bg-muted px-1.5 py-1.5 text-sm min-[400px]:gap-2 min-[400px]:px-2"
            >
              <span className="w-4 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <span className="min-w-0 break-words font-medium">{word}</span>
            </li>
          ))}
        </ol>

        {!isRevealed && (
          <div className="absolute inset-0 flex items-center justify-center p-2">
            <Button
              variant="secondary"
              className="h-auto max-w-full whitespace-normal px-3"
              onClick={() => {
                setIsRevealed(true)
              }}
            >
              <Eye />
              Show the phrase
            </Button>
          </div>
        )}
      </div>

      {isRevealed && (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsRevealed(false)
            }}
          >
            <EyeOff />
            Hide
          </Button>

          {onCopy !== undefined && (
            <Button variant="ghost" size="sm" onClick={onCopy}>
              <Copy />
              Copy
            </Button>
          )}
        </div>
      )}

      {isRevealed && onCopy !== undefined && (
        <p className="text-xs text-muted-foreground">
          The clipboard is available to other applications and may be kept in history. Copying the
          phrase by hand is safer.
        </p>
      )}
    </div>
  )
}
