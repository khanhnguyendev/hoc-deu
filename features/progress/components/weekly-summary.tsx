import { CalendarCheck, Check, Circle, Clock, ListChecks } from 'lucide-react'
import type * as React from 'react'
import { Section } from '@/components/patterns/section'
import { StatCard } from '@/components/patterns/stat-card'
import { Progress } from '@/components/ui/progress'
import { formatMinutes, formatWeekdayShort } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { WeeklySummary as WeekSummaryData } from '@/lib/domain/stats/weeklySummary'
import type { LocalDay } from '@/lib/domain/time/localDay'

const copy = vi.progress

type Track = { readonly id: string; readonly title: string; readonly accent: string }

/**
 * The week shown on `/progress` (DESIGN_SYSTEM §3.4; UI I-4): a Section titled by the week — "Tuần
 * này · {range}" only for the current one — with the week navigation (`nav`) above everything, the
 * week's stat cards under neutral labels ("Phút", "Ngày hoàn thành", "Mục đã học"), one horizontal
 * bar per enrolled track in its accent, scaled to the week's busiest track, a value label at the
 * bar end, a baseline only (`Progress`'s own track), then each day by its weekday: its minutes and
 * whether its plan was completed ("Hoàn thành" / "Chưa hoàn thành", icon + label — never colour
 * alone; never "Chưa học" beside minutes studied). A day after `today` reads only "—" (screen
 * readers: "Chưa tới") — no minutes, no "Chưa hoàn thành" for a day that has not come (M8).
 */
function WeeklySummary({
  week,
  tracks,
  title,
  today,
  nav,
}: {
  week: WeekSummaryData
  tracks: readonly Track[]
  /** The week's name (`ProgressView`: "Tuần này · 28/09 – 04/10", "Tuần trước · …", "Tuần …"). */
  title: string
  /** The learner's local day: the days after it have not come yet. */
  today: LocalDay
  /** WeekNav, above the cards. */
  nav?: React.ReactNode
}) {
  const maxMinutes = Math.max(1, ...tracks.map((track) => week.minutesByTrack[track.id] ?? 0))
  return (
    <Section title={title}>
      {nav}
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label={copy.minutes} value={Math.round(week.totalMinutes)} icon={Clock} />
        <StatCard label={copy.completedDays} value={week.completedDays} icon={CalendarCheck} />
        <StatCard label={copy.itemsDone} value={week.itemsDone} icon={ListChecks} />
      </div>
      {tracks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.noTracksTitle}</p>
      ) : (
        <ul aria-label={copy.byTrack} className="flex flex-col gap-3">
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
      <ul aria-label={copy.byDay} className="flex flex-col gap-1">
        {week.days.map((day) => (
          <li
            key={day.localDay}
            className="flex items-center justify-between gap-2 border-b border-border py-1.5 text-sm last:border-b-0"
          >
            <span className="w-32 shrink-0">{formatWeekdayShort(day.localDay)}</span>
            {/* LocalDay is a zero-padded `YYYY-MM-DD` string: string order is chronological. */}
            {day.localDay > today ? (
              <span className="flex-1 text-subtle-foreground">
                <span aria-hidden="true">—</span>
                <span className="sr-only">{copy.dayFuture}</span>
              </span>
            ) : (
              <>
                <span className="flex-1 font-mono text-muted-foreground tabular-nums">
                  {formatMinutes(day.minutes)}
                </span>
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
              </>
            )}
          </li>
        ))}
      </ul>
    </Section>
  )
}

export { WeeklySummary }
