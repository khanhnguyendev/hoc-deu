'use client'

import { Switch as SwitchPrimitive } from 'radix-ui'
import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * A 44×24 px switch (DESIGN_SYSTEM §5), with a transparent hit area of at least 44 px on the
 * short axis (`before:-inset-y-2.5`, 10 px overreach top and bottom: 24 + 10 + 10 = 44), the same
 * technique as Checkbox and RadioGroupItem. Checked: `bg-primary`; unchecked: `bg-input`.
 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent bg-input transition-colors duration-(--duration-fast) ease-standard before:absolute before:inset-x-0 before:-inset-y-2.5 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-5 rounded-full bg-surface shadow-xs transition-transform duration-(--duration-fast) ease-standard data-[state=checked]:translate-x-5.5 data-[state=unchecked]:translate-x-0.5"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
