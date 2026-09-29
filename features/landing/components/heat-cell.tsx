import { cva, type VariantProps } from 'class-variance-authority'
import { CELL, type HeatLevel } from '@/components/patterns/calendar-heatmap/levels'
import { cn } from '@/lib/utils'

const heatCellVariants = cva('relative block rounded-sm border border-border', {
  variants: {
    /** `strip`: the 7-day strip of the preview. `grid`: the band's weeks × days grid. */
    size: { strip: 'h-10 w-full', grid: 'aspect-square w-full' },
    /** Today's cell in the strip: outlined, never colour alone. */
    today: { true: 'outline-2 outline-offset-2 outline-foreground', false: '' },
    /** A blank day reads by its dashed edge, not by colour alone. */
    blank: { true: 'border-dashed border-border-strong', false: '' },
  },
  defaultVariants: { size: 'strip', today: false, blank: false },
})

/**
 * One decorative heat cell (DESIGN_SYSTEM §3.4 ramp). Always `aria-hidden`: the meaning of the
 * cells is carried by text next to them. `deepenTo` stacks a darker level over the cell and fades
 * it in (`landing-deepen`), so the cell fills to its level on first paint.
 */
function HeatCell({
  level,
  size,
  today,
  blank = false,
  deepenTo,
}: { level: HeatLevel; deepenTo?: HeatLevel } & Pick<
  VariantProps<typeof heatCellVariants>,
  'size' | 'today' | 'blank'
>) {
  return (
    <span
      aria-hidden="true"
      data-slot="heat-cell"
      data-level={deepenTo ?? level}
      className={cn(heatCellVariants({ size, today, blank }), CELL[level])}
    >
      {deepenTo !== undefined && (
        <span className={cn('absolute -inset-px landing-deepen rounded-sm', CELL[deepenTo])} />
      )}
    </span>
  )
}

export { HeatCell, heatCellVariants }
