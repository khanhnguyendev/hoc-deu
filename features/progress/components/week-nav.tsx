import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type * as React from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { vi } from '@/lib/i18n/vi'
import type { LocalDay } from '@/lib/domain/time/localDay'
import { cn } from '@/lib/utils'

const copy = vi.progress

/** One side: a link to `?week=<day>`, or a disabled button (never hidden) when there is none. */
function WeekLink({ week, children }: { week: LocalDay | null; children: React.ReactNode }) {
  const classes = cn(buttonVariants({ variant: 'outline', size: 'md' }), 'gap-1')
  if (week === null) {
    return (
      <Button variant="outline" size="md" disabled className="gap-1">
        {children}
      </Button>
    )
  }
  return (
    <Link href={`/progress?week=${week}`} className={classes}>
      {children}
    </Link>
  )
}

/**
 * Previous/next week links (`?week=`, decision 24); disabled — not hidden — at the current week,
 * and at the first whole week of the history read (m-7).
 */
function WeekNav({
  previousWeek,
  nextWeek,
}: {
  previousWeek: LocalDay | null
  nextWeek: LocalDay | null
}) {
  return (
    <nav aria-label={copy.weekNavLabel} className="flex items-center justify-between gap-2">
      <WeekLink week={previousWeek}>
        <ChevronLeft aria-hidden="true" strokeWidth={1.75} />
        {copy.previousWeek}
      </WeekLink>
      <WeekLink week={nextWeek}>
        {copy.nextWeek}
        <ChevronRight aria-hidden="true" strokeWidth={1.75} />
      </WeekLink>
    </nav>
  )
}

export { WeekNav }
