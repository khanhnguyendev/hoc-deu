'use client'

import { useEffect, useRef, useState } from 'react'
import type * as React from 'react'
import { formatMonthShort } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { cn } from '@/lib/utils'
import { cellLabel } from './cell-label'
import { addDays, yearColumns } from './dates'
import { CELL, levelFor, ON_CELL } from './levels'

const KEY_STEP: Record<string, number> = {
  ArrowLeft: -7,
  ArrowRight: 7,
  ArrowUp: -1,
  ArrowDown: 1,
}

/** ≥ 768 px: 7 rows × 53 weeks of 12 px cells with roving focus (DESIGN_SYSTEM §3.4). */
export function YearView({
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
  const columns = yearColumns(today)
  const first = columns[0]?.[0] ?? today
  const [focusDay, setFocusDay] = useState(today)
  const grid = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)

  // Start at the newest weeks: today sits at the right end of a grid wider than most screens.
  useEffect(() => {
    const element = scroller.current
    if (element) element.scrollLeft = element.scrollWidth
  }, [])

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, day: string) {
    let next: string | undefined
    if (event.key in KEY_STEP) next = addDays(day, KEY_STEP[event.key] ?? 0)
    if (event.key === 'Home') next = first
    if (event.key === 'End') next = today
    if (!next) return
    event.preventDefault()
    if (next < first || next > today) return
    setFocusDay(next)
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)?.focus()
  }

  return (
    <div ref={scroller} data-view="year" className="hidden overflow-x-auto pb-2 md:block">
      <div className="inline-flex flex-col gap-1">
        <div aria-hidden="true" className="ml-7 grid auto-cols-max grid-flow-col gap-0.75">
          {columns.map((column, i) => {
            const firstOfMonth = column.find((day) => day?.endsWith('-01'))
            const labelDay = i === 0 ? column[0] : firstOfMonth
            return (
              <span key={i} className="w-3 text-xs whitespace-nowrap text-muted-foreground">
                {labelDay ? formatMonthShort(labelDay) : ''}
              </span>
            )
          })}
        </div>
        <div className="flex gap-1">
          <div
            aria-hidden="true"
            className="grid w-6 grid-rows-7 gap-0.75 text-xs text-muted-foreground"
          >
            {vi.heatmap.weekdays.map((weekday, i) => (
              <span key={weekday} className="h-3 leading-3">
                {i % 2 === 0 ? weekday : ''}
              </span>
            ))}
          </div>
          <div
            ref={grid}
            role="group"
            aria-label={label}
            className="grid auto-cols-max grid-flow-col grid-rows-7 gap-0.75"
          >
            {columns.flatMap((column, w) =>
              column.map((day, d) => {
                if (!day) return <span key={`${w}-${d}`} aria-hidden="true" className="size-3" />
                const minutes = minutesByDay.get(day) ?? 0
                const level = levelFor(minutes)
                const name = cellLabel(day, minutes)
                return (
                  <button
                    key={day}
                    type="button"
                    data-day={day}
                    aria-label={name}
                    title={name}
                    aria-current={day === today ? 'date' : undefined}
                    tabIndex={day === focusDay ? 0 : -1}
                    onFocus={() => {
                      setFocusDay(day)
                      onActive(day)
                    }}
                    onMouseEnter={() => onActive(day)}
                    onKeyDown={(event) => onKeyDown(event, day)}
                    className={cn(
                      'relative flex size-3 items-center justify-center rounded-sm',
                      CELL[level],
                      day === today && 'ring-2 ring-ring',
                    )}
                  >
                    {level > 0 && (
                      <span
                        data-dot
                        aria-hidden="true"
                        className={cn('size-1 rounded-full', ON_CELL[level].dot)}
                      />
                    )}
                  </button>
                )
              }),
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
