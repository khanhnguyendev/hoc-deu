import { Slot } from 'radix-ui'
import type * as React from 'react'
import { cn } from '@/lib/utils'

type CardProps = React.ComponentProps<'div'> & {
  /** Clickable cards get a hover shadow (DESIGN_SYSTEM §9); wrap them in a link or button. */
  interactive?: boolean
}

/** Surface + 1 px border, padding per DESIGN_SYSTEM §5. */
function Card({ className, interactive = false, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-foreground md:gap-4 md:p-5 lg:p-6',
        interactive && 'transition-shadow duration-(--duration-fast) ease-standard hover:shadow-sm',
        className,
      )}
      {...props}
    />
  )
}

/** Title and action share the first row; the description wraps below them. */
function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex flex-wrap items-start gap-x-3 gap-y-1', className)}
      {...props}
    />
  )
}

function CardTitle({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<'h3'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'h3'
  return (
    <Comp
      data-slot="card-title"
      className={cn('min-w-0 flex-1 text-xl font-semibold', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('order-2 basis-full text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-action" className={cn('order-1 shrink-0', className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={className} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="card-footer" className={cn('flex items-center gap-3', className)} {...props} />
  )
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle }
