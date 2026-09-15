import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { ROUTE } from '@/app/router/routes'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui'

import { LOGO_STUDIES, type ILogoStudy } from './logo-lockups'

const STORAGE_KEY = 'elmsafe.logo-study-ratings-shield'

const SCORES = [1, 2, 3, 4, 5] as const

type StudyId = (typeof LOGO_STUDIES)[number]['id']

type Ratings = Partial<Record<StudyId, (typeof SCORES)[number]>>

function readRatings(): Ratings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (raw === null) {
      return {}
    }

    return JSON.parse(raw) as Ratings
  } catch {
    return {}
  }
}

/**
 * One shield, five materials. ETX is amethyst. Safe is steel.
 */
export function LogoVariantsPage() {
  const [ratings, setRatings] = useState<Ratings>({})

  useEffect(() => {
    setRatings(readRatings())
  }, [])

  const rate = (id: StudyId, score: (typeof SCORES)[number]): void => {
    setRatings((current) => {
      const next = { ...current, [id]: score }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))

      return next
    })
  }

  return (
    <div className="min-h-svh bg-background px-5 py-8">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-3">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Logo studies
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Rate the logo</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            The same shield on both brands. Gradient, crystal, liquid glass, gloss, metal. ETX is
            violet. Safe is steel.
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <Button asChild variant="outline" size="sm">
              <Link to={ROUTE.Welcome}>Back</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to={ROUTE.Variant1}>Theme studies</Link>
            </Button>
          </div>
        </header>

        <BrandSection
          title="ET Wallet"
          studies={LOGO_STUDIES.filter((study) => study.brand === 'ETX')}
          ratings={ratings}
          onRate={rate}
        />
        <BrandSection
          title="ELM"
          studies={LOGO_STUDIES.filter((study) => study.brand === 'Safe')}
          ratings={ratings}
          onRate={rate}
        />
      </main>
    </div>
  )
}

function BrandSection({
  title,
  studies,
  ratings,
  onRate,
}: {
  readonly title: string
  readonly studies: readonly ILogoStudy[]
  readonly ratings: Ratings
  readonly onRate: (id: StudyId, score: (typeof SCORES)[number]) => void
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <ol className="grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2">
        {studies.map((study) => (
          <li key={study.id}>
            <article className="flex h-full flex-col gap-4 rounded-xl border border-border/60 bg-card p-5">
              <h3 className="text-sm font-medium text-muted-foreground">{study.name}</h3>

              <div className="flex items-center justify-center gap-4 py-2">
                {study.lockup}
              </div>

              <p className="text-sm leading-6 text-muted-foreground">{study.thesis}</p>

              <fieldset className="mt-auto">
                <legend className="mb-2 text-xs font-medium text-muted-foreground">
                  Your rating for {study.name}
                </legend>
                <div className="flex gap-1.5">
                  {SCORES.map((score) => {
                    const selected = ratings[study.id] === score

                    return (
                      <button
                        key={score}
                        type="button"
                        aria-label={`${study.name}, ${score}`}
                        aria-pressed={selected}
                        className={cn(
                          'focus-ring size-10 rounded-lg text-sm font-semibold',
                          selected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground hover:bg-accent',
                        )}
                        onClick={() => {
                          onRate(study.id, score)
                        }}
                      >
                        {score}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            </article>
          </li>
        ))}
      </ol>
    </section>
  )
}
