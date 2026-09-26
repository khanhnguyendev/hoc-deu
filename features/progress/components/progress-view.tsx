import { CalendarCheck, Clock, ListChecks } from 'lucide-react'
import { CalendarHeatmap } from '@/components/patterns/calendar-heatmap'
import { EmptyState } from '@/components/patterns/empty-state'
import { PageHeader } from '@/components/patterns/page-header'
import { StatCard } from '@/components/patterns/stat-card'
import { StreakBadge } from '@/components/patterns/streak-badge'
import { vi } from '@/lib/i18n/vi'
import type { ProgressPage } from '../view-model'
import { WeekNav } from './week-nav'
import { WeeklySummary } from './weekly-summary'

const copy = vi.progress

/**
 * `/progress` (platform design §2.4, §5.7, §5.9): PageHeader, StreakBadge, the week's stats, the
 * calendar heatmap, week navigation and the weekly summary — an EmptyState when there is no
 * activity at all (RF-4: a brand-new learner).
 */
function ProgressView({ page }: { page: ProgressPage }) {
  const hasActivity = page.heatmap.some((day) => day.minutes > 0)
  return (
    <div data-slot="progress-view" className="contents">
      <PageHeader title={vi.nav.progress} actions={<StreakBadge days={page.streak} />} />
      {hasActivity ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <StatCard
              label={copy.minutesThisWeek}
              value={Math.round(page.week.totalMinutes)}
              icon={Clock}
            />
            <StatCard
              label={copy.daysThisWeek}
              value={page.week.completedDays}
              icon={CalendarCheck}
            />
            <StatCard label={copy.itemsThisWeek} value={page.week.itemsDone} icon={ListChecks} />
          </div>
          <CalendarHeatmap days={page.heatmap} today={page.today} label={copy.heatmapLabel} />
          <WeekNav previousWeek={page.previousWeek} nextWeek={page.nextWeek} />
          <WeeklySummary week={page.week} tracks={page.tracks} />
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
