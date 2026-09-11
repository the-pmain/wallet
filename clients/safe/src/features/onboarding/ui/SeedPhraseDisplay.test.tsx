import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { SeedPhraseDisplay } from './SeedPhraseDisplay'

const REAL_WORDS = [
  'alphaone',
  'betatwo',
  'gammatree',
  'deltfour',
  'epsifive',
  'zetasix',
  'etaseven',
  'thetaeight',
  'iotanine',
  'kappaten',
  'lambdaeleven',
  'mutwelve',
] as const

describe('SeedPhraseDisplay', () => {
  it('shows random words instead of the real phrase', async () => {
    const user = userEvent.setup()

    render(<SeedPhraseDisplay words={REAL_WORDS} />)

    await user.click(screen.getByRole('button', { name: /Show the phrase/i }))

    for (const word of REAL_WORDS) {
      expect(screen.queryByText(word)).not.toBeInTheDocument()
    }

    expect(screen.getAllByRole('listitem')).toHaveLength(REAL_WORDS.length)
  })
})
