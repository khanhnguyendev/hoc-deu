import { RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { ProgressRing } from '@/components/patterns/progress-ring'
import { Section } from '@/components/patterns/section'
import { StatCard } from '@/components/patterns/stat-card'
import { StreakBadge } from '@/components/patterns/streak-badge'
import { Card } from '@/components/ui/card'
import { fill, formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { TrackProgressView } from '../view-model'

const copy = vi.today.stats

/** One active track: its ring (the track accent, the percentage printed), week and due count. */
function TrackProgress({ track }: { track: TrackProgressView }) {
  const facts = [
    track.weeks > 0
      ? fill(copy.week, { week: formatNumber(track.week), weeks: formatNumber(track.weeks) })
      : null,
    fill(copy.dueCount, { n: formatNumber(track.dueCount) }),
  ].filter((fact) => fact !== null)
  return (
    <Card data-accent={track.accent} className="flex-row items-center gap-4 md:gap-4">
      <ProgressRing
        value={track.progress * 100}
        label={fill(copy.progress, { title: track.title })}
        tone="track"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-medium">{track.title}</p>
        <p className="text-sm text-muted-foreground">{facts.join(' · ')}</p>
      </div>
    </Card>
  )
}

/**
 * The dashboard's numbers (DESIGN_SYSTEM §5 order: streak + per-track progress → due reviews):
 * the StreakBadge, the due reviews as a StatCard linking to `/review`, and a ProgressRing card
 * per active track (week of weeks, due count). A new learner reads 0 everywhere, never NaN.
 */
function TodayStats({ streak, tracks }: { streak: number; tracks: readonly TrackProgressView[] }) {
  const due = tracks.reduce((sum, track) => sum + track.dueCount, 0)
  return (
    <Section title={copy.title}>
      <Card>
        <StreakBadge days={streak} />
      </Card>
      <Link
        href="/review"
        className="block rounded-lg transition-shadow duration-(--duration-fast) ease-standard hover:shadow-sm"
      >
        <StatCard label={copy.due} value={due} icon={RotateCcw} hint={copy.dueHint} />
      </Link>
      {tracks.length > 0 && (
        <ul role="list" className="flex flex-col gap-3">
          {tracks.map((track) => (
            <li key={track.trackId}>
              <TrackProgress track={track} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

export { TodayStats }
