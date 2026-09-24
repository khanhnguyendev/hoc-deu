'use client'

import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'
import type * as React from 'react'
import { cn } from '@/lib/utils'

/** A segmented control (e.g. Xong / Một phần / Bỏ qua in the check-in sheet). */
function ToggleGroup({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-md border border-border-strong p-1',
        className,
      )}
      {...props}
    />
  )
}

function ToggleGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-sm px-3 text-sm font-medium text-muted-foreground transition-colors duration-(--duration-fast) ease-standard hover:bg-surface-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-primary-soft data-[state=on]:text-primary-soft-foreground [&_svg]:size-4 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
