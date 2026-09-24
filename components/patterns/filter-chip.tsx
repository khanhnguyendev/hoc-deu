'use client'

import type * as React from 'react'
import { cn } from '@/lib/utils'
import { pillVariants, STATUS_PILL, type PillStatus } from './status-pill'

/**
 * Chips that act (DESIGN_SYSTEM §5): a 32 px pill with a transparent hit area of at least 44 px
 * (8 px above and below the padding box, so bordered chips still reach 44 px). The group keeps chips
 * 8 px apart in a row and 20 px between rows, so hit areas never overlap.
 */
function FilterChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-x-2 gap-y-5">
      {children}
    </div>
  )
}

/** A status filter toggle: the StatusPill look, `aria-pressed`, a ring when on. */
function FilterChip({
  status,
  pressed,
  onPressedChange,
}: {
  status: PillStatus
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
}) {
  const { label, icon: Icon, classes } = STATUS_PILL[status]
  return (
    <button
      type="button"
      data-slot="filter-chip"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        pillVariants({ size: 'md' }),
        classes,
        'relative before:absolute before:inset-x-0 before:-inset-y-2',
        pressed && 'ring-2 ring-primary',
      )}
    >
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0" />
      {label}
    </button>
  )
}

export { FilterChip, FilterChipGroup }
