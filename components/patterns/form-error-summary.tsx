'use client'

import { useEffect, useRef } from 'react'
import type * as React from 'react'
import { cn } from '@/lib/utils'

type FormErrorSummaryError = { fieldId: string; message: string }

/**
 * A summary at the top of long forms (DESIGN_SYSTEM §5 forms): nothing when `errors` is empty;
 * otherwise an alert, focused when the errors change, each message linking to its field.
 */
function FormErrorSummary({
  title,
  errors,
  /**
   * Increments once per submission attempt (not per render or keystroke): a second, identical
   * server error — the exact same field messages as the last one — still re-focuses and
   * re-announces the summary (M2 minor), because the key below then differs even though the
   * error content does not.
   */
  submitCount = 0,
  /**
   * Moves to a field the summary links to (M2 minor): called with the field's id instead of
   * following the link natively, so a multi-step form can switch to the field's step first, and a
   * single-section form focuses it directly — jsdom and some browsers do not reliably focus a
   * fragment target on their own. Omit it only when every field is always on screen and a plain
   * anchor jump is enough.
   */
  onNavigate,
  className,
}: {
  title: string
  errors: FormErrorSummaryError[]
  submitCount?: number
  onNavigate?: (fieldId: string) => void
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  // A content key, not the array reference: a consumer that recomputes `errors` each render
  // (e.g. from validation run on every keystroke) must not steal focus back unless the actual
  // errors changed — unless a new submission repeated them exactly (submitCount).
  const errorsKey = `${submitCount}|${errors.map((error) => `${error.fieldId}:${error.message}`).join('|')}`

  useEffect(() => {
    if (errors.length > 0) ref.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- focus only on content change (errorsKey), not identity.
  }, [errorsKey])

  function onClick(event: React.MouseEvent<HTMLUListElement>) {
    const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null
    const fieldId = link?.getAttribute('href')?.slice(1)
    if (fieldId === undefined) return
    event.preventDefault()
    if (onNavigate) onNavigate(fieldId)
    else document.getElementById(fieldId)?.focus()
  }

  if (errors.length === 0) return null

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      data-slot="form-error-summary"
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-danger bg-danger-soft p-4 text-danger-soft-foreground',
        className,
      )}
    >
      <p className="font-medium">{title}</p>
      <ul onClick={onClick} className="flex flex-col gap-1 text-sm">
        {errors.map((error) => (
          <li key={error.fieldId}>
            <a href={`#${error.fieldId}`} className="underline underline-offset-2">
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export { FormErrorSummary }
export type { FormErrorSummaryError }
