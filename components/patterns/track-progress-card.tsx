import { cva } from 'class-variance-authority'
import type * as React from 'react'
import { Card } from '@/components/ui/card'
import { fill, formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { cn } from '@/lib/utils'
import { ProgressRing } from './progress-ring'

/** A learner's progress on a track's variant (`trackProgressOf`, lib/domain): the plan
 *  engine's roadmap week of `weeks`, and the introduced active core items of `total`. */
export type TrackProgressFacts = {
  readonly week: number
  readonly weeks: number
  readonly introduced: number
  readonly total: number
}

/** "Tuần {week}/{weeks}", or null for a variant without its roadmap (0 weeks). */
export function weekOfWeeks(progress: TrackProgressFacts): string | null {
  return progress.weeks > 0
    ? fill(vi.trackProgress.week, {
        week: formatNumber(progress.week),
        weeks: formatNumber(progress.weeks),
      })
    : null
}

/** Introduced core items as a percentage — 0 without core items (a new learner: never NaN). */
export function progressPercent(progress: TrackProgressFacts): number {
  return progress.total === 0 ? 0 : (progress.introduced / progress.total) * 100
}

const cardVariants = cva('flex-row items-center gap-4 md:gap-4', {
  variants: {
    size: { md: '', lg: 'flex-wrap justify-between' },
  },
  defaultVariants: { size: 'md' },
})

const headlineVariants = cva('', {
  variants: {
    size: { md: 'font-medium', lg: 'text-lg font-semibold' },
  },
  defaultVariants: { size: 'md' },
})

/**
 * One track's progress (m-1: `/today`'s TodayStats and the track page's TrackProgress each had
 * their own): a ProgressRing in the track accent — the percentage printed, never colour alone —
 * named "Tiến độ {title}", a headline and a line of facts joined with " · ", and an `actions` slot,
 * on the `Card` primitive. `md` (`/today`: the track's title, then its week and due count) or `lg`
 * (the track page: the week as headline, the core count, "Bắt đầu lại"). `accent` sets the
 * `data-accent` the ring's colour reads; without it an ancestor must set one. Server-compatible.
 */
function TrackProgressCard({
  title,
  progress,
  accent,
  size = 'md',
  headline,
  facts = [],
  actions,
}: {
  /** The track's title: names the ring for screen readers. */
  title: string
  progress: TrackProgressFacts
  accent?: string
  size?: 'md' | 'lg'
  headline?: string | null
  /** Short facts; null entries are left out. */
  facts?: readonly (string | null)[]
  actions?: React.ReactNode
}) {
  const shown = facts.filter((fact): fact is string => fact !== null && fact !== '')
  return (
    <Card
      data-slot="track-progress-card"
      data-accent={accent}
      className={cn(cardVariants({ size }))}
    >
      <div className="flex min-w-0 items-center gap-4">
        <ProgressRing
          value={progressPercent(progress)}
          label={fill(vi.trackProgress.ring, { title })}
          tone="track"
          size={size}
        />
        <div className="flex min-w-0 flex-col gap-1">
          {headline && <p className={cn(headlineVariants({ size }))}>{headline}</p>}
          {shown.length > 0 && <p className="text-sm text-muted-foreground">{shown.join(' · ')}</p>}
        </div>
      </div>
      {actions}
    </Card>
  )
}

export { TrackProgressCard }
