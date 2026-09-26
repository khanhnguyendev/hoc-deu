import { Check, Circle } from 'lucide-react'
import { Section } from '@/components/patterns/section'
import { Progress } from '@/components/ui/progress'
import { formatMinutes } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { WeeklySummary as WeekSummaryData } from '@/lib/domain/stats/weeklySummary'
import { weekRangeLabel } from '../view-model'

const copy = vi.progress

type Track = { readonly id: string; readonly title: string; readonly accent: string }

function dayOfMonth(localDay: string): string {
  return localDay.slice(8, 10)
}

/**
 * The requested week (DESIGN_SYSTEM §3.4): one horizontal bar per enrolled track in its accent,
 * scaled to the week's busiest track, a value label at the bar end, a baseline only (`Progress`'s
 * own track), then a per-day list (minutes, done / not — never colour alone).
 */
function WeeklySummary({ week, tracks }: { week: WeekSummaryData; tracks: readonly Track[] }) {
  const maxMinutes = Math.max(1, ...tracks.map((track) => week.minutesByTrack[track.id] ?? 0))
  return (
    <Section title={copy.weekSummaryTitle} description={weekRangeLabel(week.weekStart)}>
      {tracks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.noTracksTitle}</p>
      ) : (
        <ul aria-label={copy.weekSummaryTitle} className="flex flex-col gap-3">
          {tracks.map((track) => {
            const minutes = week.minutesByTrack[track.id] ?? 0
            const pct = (minutes / maxMinutes) * 100
            return (
              <li
                key={track.id}
                data-accent={track.accent}
                className="flex items-center gap-3 text-sm"
              >
                <span className="w-32 shrink-0 truncate">{track.title}</span>
                <Progress
                  value={pct}
                  tone="track"
                  aria-label={track.title}
                  aria-valuetext={formatMinutes(minutes)}
                  className="flex-1"
                />
                <span className="w-16 shrink-0 text-right font-mono tabular-nums">
                  {formatMinutes(minutes)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <ul className="flex flex-col gap-1">
        {week.days.map((day) => (
          <li
            key={day.localDay}
            className="flex items-center justify-between gap-2 border-b border-border py-1.5 text-sm last:border-b-0"
          >
            <span className="font-mono tabular-nums">{dayOfMonth(day.localDay)}</span>
            <span className="flex-1 text-muted-foreground">{formatMinutes(day.minutes)}</span>
            <span className="flex items-center gap-1.5">
              {day.completed ? (
                <Check aria-hidden="true" strokeWidth={1.75} className="size-4 text-success" />
              ) : (
                <Circle
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4 text-subtle-foreground"
                />
              )}
              {day.completed ? copy.dayDone : copy.dayNotDone}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

export { WeeklySummary }
