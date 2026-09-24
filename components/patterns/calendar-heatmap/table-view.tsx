'use client'

import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatDay, formatMinutes } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'

/** The accessible table fallback: every active day, newest first. */
export function TableView({ minutesByDay }: { minutesByDay: ReadonlyMap<string, number> }) {
  const [open, setOpen] = useState(false)
  const tableId = useId()
  const active = [...minutesByDay.entries()]
    .filter(([, minutes]) => minutes > 0)
    .sort(([a], [b]) => (a < b ? 1 : -1))

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="link"
        className="self-start px-0"
        aria-expanded={open}
        aria-controls={tableId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? vi.heatmap.hideTable : vi.heatmap.showTable}
      </Button>
      {open && (
        <div id={tableId}>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">{vi.heatmap.noActivity}</p>
          ) : (
            <table className="w-full max-w-sm text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 font-medium">
                    {vi.heatmap.day}
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    {vi.heatmap.minutes}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {active.map(([day, minutes]) => (
                  <tr key={day}>
                    <td className="py-2">{formatDay(day)}</td>
                    <td className="py-2 font-mono tabular-nums">{formatMinutes(minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
