'use client'

import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import type * as React from 'react'
import { cn } from '@/lib/utils'

/** A vertical stack of radio options, `gap-3` (DESIGN_SYSTEM §5). */
function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn('flex flex-col gap-3', className)}
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
