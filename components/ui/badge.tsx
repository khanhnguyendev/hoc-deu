import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-muted text-foreground',
        primary: 'bg-primary-soft text-primary-soft-foreground',
        success: 'bg-success-soft text-success-soft-foreground',
        warning: 'bg-warning-soft text-warning-soft-foreground',
        danger: 'bg-danger-soft text-danger-soft-foreground',
        /** Track chip: needs a `data-accent="track-N"` ancestor (DESIGN_SYSTEM §3.2). */
        track: 'bg-track-soft text-track',
        outline: 'border border-border-strong text-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

function Badge({
  className,
  tone,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span'
  const resolvedTone = tone ?? 'neutral'
  return (
    <Comp
      data-slot="badge"
      data-tone={resolvedTone}
      className={cn(badgeVariants({ tone: resolvedTone }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
