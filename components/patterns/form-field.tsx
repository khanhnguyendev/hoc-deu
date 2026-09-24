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
 * The error line under a field (DESIGN_SYSTEM §5 forms): `text-danger` with an icon, never colour
 * alone. FormField renders it for its control; a group of checkboxes or radios (no single control
 * to label) renders it under the group and points the group's `aria-describedby` at its `id`.
 */
function FormFieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p
      id={id}
      data-slot="form-field-error"
      className="flex items-center gap-1.5 text-sm text-danger"
    >
      <CircleAlert aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
      {children}
    </p>
  )
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
      {error && <FormFieldError id={errorId}>{error}</FormFieldError>}
    </div>
  )
}

export { FormField, FormFieldError }
export type { FormFieldControlProps }
