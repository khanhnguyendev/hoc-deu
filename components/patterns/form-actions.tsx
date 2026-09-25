import type * as React from 'react'
import { Banner } from '@/components/patterns/banner'
import { cn } from '@/lib/utils'

/**
 * A form's action row with its form-level failure right above it (DESIGN_SYSTEM §5, §9): the
 * failure sits in an always-mounted `role="alert"` region, so it is announced when it appears,
 * as a danger Banner — a toast is never the only feedback for a failed save. The region and the
 * row share one block, so an empty region adds no gap to a flex form.
 */
function FormActions({
  error,
  label,
  children,
  className,
}: {
  /** The form-level failure, or null. */
  error: string | null
  /** Names the buttons as a group (e.g. "Thao tác với {title}"), when they need a context. */
  label?: string
  /** The buttons. */
  children: React.ReactNode
  className?: string
}) {
  return (
    <div data-slot="form-actions" className={className}>
      <div role="alert">{error && <Banner tone="danger">{error}</Banner>}</div>
      <div
        role={label === undefined ? undefined : 'group'}
        aria-label={label}
        className={cn('flex flex-wrap items-center gap-2', error && 'mt-3')}
      >
        {children}
      </div>
    </div>
  )
}

export { FormActions }
