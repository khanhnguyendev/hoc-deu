'use client'

import { Progress as ProgressPrimitive } from 'radix-ui'
import type * as React from 'react'
import { cn } from '@/lib/utils'

type ProgressProps = Omit<React.ComponentProps<typeof ProgressPrimitive.Root>, 'value' | 'max'> & {
  /** Percent, clamped to 0–100. */
  value: number
  /** `track` needs a `data-accent="track-N"` ancestor (DESIGN_SYSTEM §3.2). */
  tone?: 'primary' | 'track'
}

function Progress({ className, value, tone = 'primary', ...props }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={clamped}
      max={100}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-surface-sunken',
        className,
      )}
      {...props}
    >
      {/* Moves with a transform, never a width animation (DESIGN_SYSTEM §7). */}
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          'size-full -translate-x-(--progress-remaining) transition-transform duration-(--duration-base) ease-standard',
          tone === 'track' ? 'bg-track' : 'bg-primary',
        )}
        style={{ '--progress-remaining': `${100 - clamped}%` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
