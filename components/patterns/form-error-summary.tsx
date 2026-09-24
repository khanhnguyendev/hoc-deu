'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

type FormErrorSummaryError = { fieldId: string; message: string }

/**
 * A summary at the top of long forms (DESIGN_SYSTEM §5 forms): nothing when `errors` is empty;
 * otherwise an alert, focused when the errors change, each message linking to its field.
 */
function FormErrorSummary({
  title,
  errors,
  className,
}: {
  title: string
  errors: FormErrorSummaryError[]
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  // A content key, not the array reference: a consumer that recomputes `errors` each render
  // (e.g. from validation run on every keystroke) must not steal focus back unless the actual
  // errors changed.
  const errorsKey = errors.map((error) => `${error.fieldId}:${error.message}`).join('|')

  useEffect(() => {
    if (errors.length > 0) ref.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- focus only on content change (errorsKey), not identity.
  }, [errorsKey])

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
      <ul className="flex flex-col gap-1 text-sm">
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
