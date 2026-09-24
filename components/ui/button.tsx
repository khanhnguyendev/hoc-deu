import { cva, type VariantProps } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-react'
import { Slot } from 'radix-ui'
import type * as React from 'react'
import { cn } from '@/lib/utils'

/** DESIGN_SYSTEM §9: sm 36 px (desktop only), md 44 px (default), lg 48 px. */
const buttonVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors duration-(--duration-fast) ease-standard disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover',
        secondary: 'bg-surface-muted text-foreground hover:bg-surface-sunken',
        outline:
          'border border-border-strong bg-surface text-foreground shadow-xs hover:bg-surface-muted',
        ghost: 'text-foreground hover:bg-surface-muted',
        destructive: 'bg-danger text-danger-foreground shadow-xs hover:bg-danger/90',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 gap-1.5 px-3 text-sm [&_svg]:size-4',
        md: 'h-11 px-4 text-base [&_svg]:size-5',
        lg: 'h-12 px-6 text-base [&_svg]:size-5',
        icon: 'size-11 [&_svg]:size-5',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (e.g. a link) with button styling. */
    asChild?: boolean
    /** Show a spinner, keep the width, disable and mark `aria-busy`. */
    loading?: boolean
  }

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  type,
  children,
  ...props
}: ButtonProps) {
  const resolvedVariant = variant ?? 'primary'
  const resolvedSize = size ?? 'md'
  const classes = cn(buttonVariants({ variant: resolvedVariant, size: resolvedSize }), className)

  if (asChild) {
    return (
      <Slot.Root
        data-slot="button"
        data-variant={resolvedVariant}
        data-size={resolvedSize}
        className={classes}
        {...props}
      >
        {children}
      </Slot.Root>
    )
  }

  return (
    <button
      data-slot="button"
      data-variant={resolvedVariant}
      data-size={resolvedSize}
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...props}
    >
      {loading ? (
        <>
          <LoaderCircle aria-hidden="true" strokeWidth={1.75} className="absolute animate-spin" />
          {/* Transparent, not hidden: the label keeps the width and the accessible name. */}
          <span className="inline-flex items-center gap-2 opacity-0">{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}

export { Button, buttonVariants }
export type { ButtonProps }
