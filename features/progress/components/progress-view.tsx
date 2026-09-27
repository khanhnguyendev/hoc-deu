import { CalendarCheck } from 'lucide-react'
import { CalendarHeatmap } from '@/components/patterns/calendar-heatmap'
import { EmptyState } from '@/components/patterns/empty-state'
import { PageHeader } from '@/components/patterns/page-header'
import { StreakBadge } from '@/components/patterns/streak-badge'
import { fill } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { weekRangeLabel, type ProgressPage } from '../view-model'
import { WeekNav } from './week-nav'
import { WeeklySummary } from './weekly-summary'

const copy = vi.progress

/** The week's name (UI I-4): "Tuần này · {range}", "Tuần trước · {range}", or "Tuần {range}". */
function weekTitle(page: ProgressPage): string {
  return fill(copy.week[page.relation], { range: weekRangeLabel(page.week.weekStart) })
}

/**
 * `/progress` (platform design §2.4, §5.7, §5.9): PageHeader with the StreakBadge, the calendar
 * heatmap, then the week shown — a section named by that week (UI I-4), its navigation first, its
 * stats, bars and days (WeeklySummary) — or an EmptyState when there is no activity at all (RF-4:
 * a brand-new learner).
 */
function ProgressView({ page }: { page: ProgressPage }) {
  const hasActivity = page.heatmap.some((day) => day.minutes > 0)
  return (
    <div data-slot="progress-view" className="contents">
      <PageHeader title={vi.nav.progress} actions={<StreakBadge days={page.streak} />} />
      {hasActivity ? (
        <>
          <CalendarHeatmap days={page.heatmap} today={page.today} label={copy.heatmapLabel} />
          <WeeklySummary
            week={page.week}
            tracks={page.tracks}
            title={weekTitle(page)}
            today={page.today}
            nav={<WeekNav previousWeek={page.previousWeek} nextWeek={page.nextWeek} />}
          />
        </>
      ) : (
        <EmptyState
          icon={CalendarCheck}
          title={copy.emptyTitle}
          action={{ label: vi.nav.today, href: '/today' }}
        />
      )}
    </div>
  )
}

export { ProgressView }
