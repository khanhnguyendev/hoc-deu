import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { vi } from '@/lib/i18n/vi'
import type { LocalDay } from '@/lib/domain/time/localDay'
import { cn } from '@/lib/utils'

const copy = vi.progress

/** Previous/next week links (`?week=`, decision 24); disabled — not hidden — at the current week. */
function WeekNav({
  previousWeek,
  nextWeek,
}: {
  previousWeek: LocalDay
  nextWeek: LocalDay | null
}) {
  return (
    <nav aria-label={copy.weekNavLabel} className="flex items-center justify-between gap-2">
      <Link
        href={`/progress?week=${previousWeek}`}
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1')}
      >
        <ChevronLeft aria-hidden="true" strokeWidth={1.75} />
        {copy.previousWeek}
      </Link>
      {nextWeek === null ? (
        <Button variant="outline" size="sm" disabled className="gap-1">
          {copy.nextWeek}
          <ChevronRight aria-hidden="true" strokeWidth={1.75} />
        </Button>
      ) : (
        <Link
          href={`/progress?week=${nextWeek}`}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1')}
        >
          {copy.nextWeek}
          <ChevronRight aria-hidden="true" strokeWidth={1.75} />
        </Link>
      )}
    </nav>
  )
}

export { WeekNav }
