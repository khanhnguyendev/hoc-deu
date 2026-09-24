import { CircleAlert } from 'lucide-react'
import type * as React from 'react'
import { Label } from '@/components/ui/label'
import { vi } from '@/lib/i18n/vi'
import { cn } from '@/lib/utils'

type FormFieldControlProps = {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
  required?: boolean
}

/**
 * Label above the field, helper text below, errors under the field (DESIGN_SYSTEM §5 forms):
 * `aria-describedby` joins the description and error ids, `aria-invalid` is set from `error`.
 */
function FormField({
  id,
  label,
  description,
  error,
  required = false,
  children,
  className,
}: {
  id: string
  label: string
  description?: string
  error?: string
  required?: boolean
  children: (control: FormFieldControlProps) => React.ReactNode
  className?: string
}) {
  const descriptionId = description ? `${id}-description` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div data-slot="form-field" className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <>
            <span aria-hidden="true"> *</span>
            <span className="sr-only"> ({vi.forms.required})</span>
          </>
        )}
      </Label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        required: required || undefined,
      })}
      {description && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-center gap-1.5 text-sm text-danger">
          <CircleAlert aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

export { FormField }
export type { FormFieldControlProps }
