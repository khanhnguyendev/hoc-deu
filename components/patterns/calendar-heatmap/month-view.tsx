'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatMonth } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { cn } from '@/lib/utils'
import { cellLabel } from './cell-label'
import { addMonths, monthGrid } from './dates'
import { CELL, levelFor, ON_CELL } from './levels'

const SWIPE_PX = 40

/** < 768 px: one month of 44 px day cells, previous/next buttons and swipe (DESIGN_SYSTEM §3.4). */
export function MonthView({
  minutesByDay,
  today,
  label,
  onActive,
}: {
  minutesByDay: ReadonlyMap<string, number>
  today: string
  label: string
  onActive: (day: string) => void
}) {
  const current = addMonths(today, 0)
  const [month, setMonth] = useState(current)
  const [selected, setSelected] = useState<string | null>(null)
  const swipeStart = useRef<number | null>(null)
  const titleId = useId()
  const canGoNext = month < current

  function go(delta: number) {
    const next = addMonths(month, delta)
    if (next <= current) setMonth(next)
  }

  return (
    <div data-view="month" className="flex flex-col gap-3 md:hidden">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={vi.heatmap.previousMonth}
          onClick={() => go(-1)}
        >
          <ChevronLeft aria-hidden="true" strokeWidth={1.75} />
        </Button>
        <p id={titleId} aria-live="polite" className="font-medium">
          {formatMonth(month)}
        </p>
        <Button
          variant="ghost"
          size="icon"
          aria-label={vi.heatmap.nextMonth}
          disabled={!canGoNext}
          onClick={() => go(1)}
        >
          <ChevronRight aria-hidden="true" strokeWidth={1.75} />
        </Button>
      </div>
      <div
        aria-hidden="true"
        className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground"
      >
        {vi.heatmap.weekdays.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <div
        role="group"
        aria-label={label}
        aria-describedby={titleId}
        className="grid touch-pan-y grid-cols-7 gap-1"
        onPointerDown={(event) => {
          swipeStart.current = event.clientX
        }}
        onPointerUp={(event) => {
          if (swipeStart.current === null) return
          const dx = event.clientX - swipeStart.current
          swipeStart.current = null
          if (Math.abs(dx) >= SWIPE_PX) go(dx < 0 ? 1 : -1)
        }}
      >
        {monthGrid(month).map((day, i) => {
          if (!day) return <span key={`pad-${i}`} aria-hidden="true" className="size-11" />
          const dayNumber = Number(day.slice(8))
          if (day > today) {
            return (
              <span
                key={day}
                aria-hidden="true"
                className="flex size-11 items-center justify-center rounded-md text-sm text-subtle-foreground"
              >
                {dayNumber}
              </span>
            )
          }
          const minutes = minutesByDay.get(day) ?? 0
          const level = levelFor(minutes)
          return (
            <button
              key={day}
              type="button"
              aria-label={cellLabel(day, minutes)}
              aria-current={day === today ? 'date' : undefined}
              aria-pressed={day === selected}
              onClick={() => {
                setSelected(day)
                onActive(day)
              }}
              className={cn(
                'relative flex size-11 flex-col items-center justify-center gap-0.5 rounded-md text-sm font-medium tabular-nums',
                CELL[level],
                ON_CELL[level].text,
                day === today && 'ring-2 ring-ring',
              )}
            >
              {dayNumber}
              {level > 0 && (
                <span
                  data-dot
                  aria-hidden="true"
                  className={cn('size-1 rounded-full', ON_CELL[level].dot)}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
