import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/shared/ui'

interface AdminListPagerProps {
  readonly page: number
  readonly pageSize: number
  readonly total: number
  readonly onPageChange: (page: number) => void
}

/**
 * Page switcher for cabinet lists. Hidden when everything fits on one
 * page — the list heading already carries the count.
 */
export function AdminListPager({ page, pageSize, total, onPageChange }: AdminListPagerProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  if (total === 0 || pageCount <= 1) {
    return null
  }

  return (
    <nav className="flex items-center justify-end gap-1 pt-1" aria-label="Pagination">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={page <= 1}
        aria-label="Previous page"
        onClick={() => {
          onPageChange(page - 1)
        }}
      >
        <ChevronLeft />
      </Button>
      <p
        className="min-w-10 text-center text-xs tabular-nums text-muted-foreground"
        aria-live="polite"
        aria-label={`Page ${String(page)} of ${String(pageCount)}`}
      >
        {String(page)} / {String(pageCount)}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={page >= pageCount}
        aria-label="Next page"
        onClick={() => {
          onPageChange(page + 1)
        }}
      >
        <ChevronRight />
      </Button>
    </nav>
  )
}
