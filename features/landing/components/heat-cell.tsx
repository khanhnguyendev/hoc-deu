import { cva, type VariantProps } from 'class-variance-authority'
import { CELL, type HeatLevel } from '@/components/patterns/calendar-heatmap/levels'
import { cn } from '@/lib/utils'

const heatCellVariants = cva('relative block rounded-sm border border-border', {
  variants: {
    /** `strip`: the 7-day strip of the preview. `grid`: the band's weeks × days grid. */
    size: { strip: 'h-10 w-full', grid: 'h-8 w-full md:h-10' },
    /** Today's cell in the strip: outlined, never colour alone. */
    today: { true: 'outline-2 outline-offset-2 outline-foreground', false: '' },
  },
  defaultVariants: { size: 'strip', today: false },
})

/**
 * One decorative heat cell (DESIGN_SYSTEM §3.4 ramp). Always `aria-hidden`: the meaning of the
 * cells is carried by text next to them. `deepenTo` stacks a darker level over the cell and fades
 * it in (`landing-deepen`), so the cell deepens one level on first paint.
 */
function HeatCell({
  level,
  size,
  today,
  deepenTo,
}: { level: HeatLevel; deepenTo?: HeatLevel } & VariantProps<typeof heatCellVariants>) {
  return (
    <span
      aria-hidden="true"
      data-slot="heat-cell"
      data-level={deepenTo ?? level}
      className={cn(heatCellVariants({ size, today }), CELL[level])}
    >
      {deepenTo !== undefined && (
        <span className={cn('absolute -inset-px landing-deepen rounded-sm', CELL[deepenTo])} />
      )}
    </span>
  )
}

export { HeatCell, heatCellVariants }
