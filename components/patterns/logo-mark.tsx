import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/** Six calendar-heatmap cells in an even staircase (`docs/design/brand-kit/README.md`). */
const CELLS = [
  [2, 0],
  [2, 1],
  [2, 2],
  [1, 1],
  [1, 2],
  [0, 2],
] as const

const COLUMNS = ['c0', 'c1', 'c2'] as const

/** The heat ramp deepens left to right; never copy-pasted, one variant per column (CLAUDE.md). */
const cellFill = cva('', {
  variants: {
    column: {
      c0: 'fill-heat-1 dark:fill-heat-2',
      c1: 'fill-heat-2 dark:fill-heat-3',
      c2: 'fill-heat-3 dark:fill-heat-4',
    },
  },
})

/**
 * The Học Đều mark, drawn inline so it follows the theme and passes the token guard (no hex, no
 * arbitrary values) instead of shipping as an `<img>` of `svg/mark/*`. Decorative: the wordmark
 * text next to it (never this component alone) carries the accessible name "Học Đều" (task 6.0b).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 84 84" aria-hidden="true" className={cn('size-6 shrink-0', className)}>
      {CELLS.map(([r, c]) => (
        <rect
          key={`${r}-${c}`}
          x={c * 30}
          y={r * 30}
          width={24}
          height={24}
          rx={4.36}
          className={cellFill({ column: COLUMNS[c] })}
        />
      ))}
    </svg>
  )
}
