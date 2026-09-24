'use client'

import { useState } from 'react'
import { formatDayLong, formatMinutes } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { Legend } from './legend'
import { MonthView } from './month-view'
import { TableView } from './table-view'
import { YearView } from './year-view'

type HeatmapDay = { day: string; minutes: number }

/**
 * Study minutes per local day (DESIGN_SYSTEM §3.4): a year view from 1024 px with a fine pointer,
 * a month view below that or on touch screens,
 * the legend, a detail line that follows focus, hover and taps, and a table fallback. The
 * caller passes `today` (the learner's local day); the pattern never reads the clock.
 */
function CalendarHeatmap({
  days,
  today,
  label,
}: {
  days: readonly HeatmapDay[]
  today: string
  label: string
}) {
  const minutesByDay = new Map<string, number>()
  for (const { day, minutes } of days) {
    minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + minutes)
  }
  const [active, setActive] = useState<string | null>(null)

  return (
    <div data-slot="calendar-heatmap" className="flex w-full min-w-0 flex-col gap-3">
      <YearView minutesByDay={minutesByDay} today={today} label={label} onActive={setActive} />
      <MonthView minutesByDay={minutesByDay} today={today} label={label} onActive={setActive} />
      {/* Not a live region: each focused or tapped day already announces its own label. */}
      <p data-slot="heatmap-detail" className="min-h-6 text-sm text-muted-foreground">
        {active
          ? `${formatDayLong(active)}: ${formatMinutes(minutesByDay.get(active) ?? 0)}`
          : vi.heatmap.pickDay}
      </p>
      <Legend />
      <TableView minutesByDay={minutesByDay} />
    </div>
  )
}

export { CalendarHeatmap }
export type { HeatmapDay }
