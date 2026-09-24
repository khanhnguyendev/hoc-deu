import type * as React from 'react'
import { cn } from '@/lib/utils'

/** A content-shaped placeholder; static under reduced motion (tokens zero all animations). */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-surface-sunken dark:bg-surface-muted', className)}
      {...props}
    />
  )
}

export { Skeleton }
