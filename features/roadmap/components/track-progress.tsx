import type * as React from 'react'
import { ProgressRing } from '@/components/patterns/progress-ring'
import { Section } from '@/components/patterns/section'
import { fill, formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { TrackProgressData } from '../view-model'

const copy = vi.extra.progress

/**
 * The learner's progress on the track page (§2.4; Part B-M3 decision 25; task 5.4): a ProgressRing
 * in the track accent (the percentage printed — never colour alone) of the introduced core items
 * of the enrolled variant, "Tuần {x}/{N}" and "{introduced}/{total} bài chính đã học" — each only
 * when the variant's roadmap has them (a missing roadmap file shows the ring at 0 %) — and the
 * `actions` slot ("Bắt đầu lại"). Server-compatible; needs the TrackOverview's `data-accent`.
 */
function TrackProgress({
  title,
  progress,
  actions,
}: {
  /** The track's title, naming the ring for screen readers. */
  title: string
  progress: TrackProgressData
  actions?: React.ReactNode
}) {
  const percent = progress.total === 0 ? 0 : (progress.introduced / progress.total) * 100
  return (
    <Section title={copy.title}>
      <div
        data-slot="track-progress"
        className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4 md:p-5"
      >
        <div className="flex items-center gap-4">
          <ProgressRing value={percent} label={fill(copy.ring, { title })} tone="track" size="lg" />
          <div className="flex flex-col gap-1">
            {progress.weeks > 0 && (
              <p className="text-lg font-semibold">
                {fill(copy.week, {
                  week: formatNumber(progress.week),
                  weeks: formatNumber(progress.weeks),
                })}
              </p>
            )}
            {progress.total > 0 && (
              <p className="text-sm text-muted-foreground">
                {fill(copy.core, {
                  introduced: formatNumber(progress.introduced),
                  total: formatNumber(progress.total),
                })}
              </p>
            )}
          </div>
        </div>
        {actions}
      </div>
    </Section>
  )
}

export { TrackProgress }
