'use client'

import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * A vertical stack of radio options (DESIGN_SYSTEM §5). Each item is 20 px with a transparent
 * hit area of at least 44 px (`before:-inset-3` on RadioGroupItem below, 12 px overreach on every
 * side), so the default gap is `gap-8` (32 px): 12 + 12 px of overreach + 8 px clearance = 32 px —
 * the same "hit area ≥ 44 px, ≥ 8 px between adjacent targets" math as FilterChip, keeping two
 * stacked 44 px hit areas from overlapping. A consumer that wraps each item in a ChoiceCard (the
 * card itself is the tappable target, not the bare radio) overrides this with `className`.
 */
function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn('flex flex-col gap-8', className)}
      {...props}
    />
  )
}

/** Same 20 px box and 44 px hit area as Checkbox. */
function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        'relative inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface transition-colors duration-(--duration-fast) ease-standard before:absolute before:-inset-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger data-[state=checked]:border-primary',
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="size-2.5 rounded-full bg-primary"
      />
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
