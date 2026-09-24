import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * A `<label>` card (DESIGN_SYSTEM §5): clicking anywhere in the card toggles its control (native
 * label behaviour). Selected state comes from the control's `data-state`, so it is not colour
 * alone — the control itself shows the check.
 */
function ChoiceCard({
  htmlFor,
  control,
  title,
  description,
  className,
}: {
  htmlFor: string
  control: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  className?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      data-slot="choice-card"
      className={cn(
        'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface p-4 transition-colors duration-(--duration-fast) ease-standard has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary-soft',
        className,
      )}
    >
      {control}
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-medium text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
    </label>
  )
}

export { ChoiceCard }
