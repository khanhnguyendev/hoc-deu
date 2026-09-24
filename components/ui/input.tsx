import type * as React from 'react'
import { cn } from '@/lib/utils'

/** Shared by Input and Textarea (DESIGN_SYSTEM §9): 44 px, strong border, 16 px text (no iOS zoom). */
const fieldClasses =
  'w-full min-w-0 rounded-md border border-border-strong bg-surface px-3 text-base text-foreground transition-colors duration-(--duration-fast) ease-standard placeholder:text-subtle-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(fieldClasses, 'h-11', className)}
      {...props}
    />
  )
}

export { fieldClasses, Input }
