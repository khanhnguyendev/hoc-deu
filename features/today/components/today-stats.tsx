import { RotateCcw } from 'lucide-react'
import { Section } from '@/components/patterns/section'
import { StatCard } from '@/components/patterns/stat-card'
import { StreakBadge } from '@/components/patterns/streak-badge'
import { TrackProgressCard, weekOfWeeks } from '@/components/patterns/track-progress-card'
import { Card } from '@/components/ui/card'
import { fill, formatDay, formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { TrackProgressView } from '../view-model'

const copy = vi.today.stats

/** One active track's card (TrackProgressCard, m-1): its ring, week and due count or start date. */
function TrackProgress({ track }: { track: TrackProgressView }) {
  return (
    <TrackProgressCard
      title={track.title}
      accent={track.accent}
      progress={track.progress}
      headline={track.title}
      facts={[
        weekOfWeeks(track.progress),
        track.startsOn === null
          ? fill(copy.dueCount, { n: formatNumber(track.dueCount) })
          : fill(copy.startsOn, { date: formatDay(track.startsOn) }),
      ]}
    />
  )
}

/**
 * The dashboard's numbers in the DESIGN_SYSTEM §5 order — streak + per-track progress → due
 * reviews: the StreakBadge, a TrackProgressCard per active track (week of weeks, due count), then
 * the due reviews as a StatCard linking to `/review` (`href`, m-2). A new learner reads 0
 * everywhere, never NaN.
 */
function TodayStats({ streak, tracks }: { streak: number; tracks: readonly TrackProgressView[] }) {
  const due = tracks.reduce((sum, track) => sum + track.dueCount, 0)
  return (
    <Section title={copy.title}>
      <Card>
        <StreakBadge days={streak} />
      </Card>
      {tracks.length > 0 && (
        <ul role="list" className="flex flex-col gap-3">
          {tracks.map((track) => (
            <li key={track.trackId}>
              <TrackProgress track={track} />
            </li>
          ))}
        </ul>
      )}
      <StatCard label={copy.due} value={due} icon={RotateCcw} hint={copy.dueHint} href="/review" />
    </Section>
  )
}

export { TodayStats }
