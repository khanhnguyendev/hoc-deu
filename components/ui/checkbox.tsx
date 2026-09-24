'use client'

import { Check } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * 20 px box (DESIGN_SYSTEM §5) with a transparent hit area of at least 44 px, the same
 * `relative`/`before:` technique as FilterChip. Checked: `bg-primary text-primary-foreground`.
 */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer relative inline-flex size-5 shrink-0 items-center justify-center rounded-sm border border-border-strong bg-surface text-primary-foreground transition-colors duration-(--duration-fast) ease-standard before:absolute before:-inset-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger data-[state=checked]:border-primary data-[state=checked]:bg-primary',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        <Check aria-hidden="true" strokeWidth={2.5} className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
