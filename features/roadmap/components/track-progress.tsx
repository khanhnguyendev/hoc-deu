import type * as React from 'react'
import { Section } from '@/components/patterns/section'
import { TrackProgressCard, weekOfWeeks } from '@/components/patterns/track-progress-card'
import { fill, formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { TrackProgressData } from '../view-model'

const copy = vi.extra.progress

/**
 * The learner's progress on the track page (§2.4; Part B-M3 decision 25; task 5.4): a Section
 * "Tiến độ của bạn" holding the large TrackProgressCard (the pattern `/today` uses too, m-1) — the
 * ring of the introduced core items of the enrolled variant, "Tuần {x}/{N}" and "{introduced}/
 * {total} bài chính đã học", each only when the variant's roadmap has them (a missing roadmap
 * file shows the ring at 0 %) — and the `actions` slot ("Bắt đầu lại"). Server-compatible; needs
 * the TrackOverview's `data-accent`.
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
  return (
    <Section title={copy.title}>
      <TrackProgressCard
        title={title}
        progress={progress}
        size="lg"
        headline={weekOfWeeks(progress)}
        facts={[
          progress.total > 0
            ? fill(copy.core, {
                introduced: formatNumber(progress.introduced),
                total: formatNumber(progress.total),
              })
            : null,
        ]}
        actions={actions}
      />
    </Section>
  )
}

export { TrackProgress }
