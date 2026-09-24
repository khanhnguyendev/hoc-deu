import { vi } from '@/lib/i18n/vi'
import { cn } from '@/lib/utils'
import { CELL, type HeatLevel } from './levels'

const LEVELS: HeatLevel[] = [0, 1, 2, 3, 4]

/** The five minute ranges; each swatch is labelled, never colour alone. */
export function Legend() {
  return (
    <ul aria-label={vi.heatmap.legend} className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {LEVELS.map((level) => (
        <li key={level} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden="true" className={cn('size-3 rounded-sm', CELL[level])} />
          {vi.heatmap.levels[level]}
        </li>
      ))}
    </ul>
  )
}
