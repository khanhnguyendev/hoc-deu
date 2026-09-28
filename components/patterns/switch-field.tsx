'use client'

import type * as React from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { FormFieldError } from './form-field'

/**
 * A switch row that saves the moment it is flipped (DESIGN_SYSTEM §5 switch): the Switch with its
 * visible Label beside it, an optional description under it and an always-mounted `role="alert"`
 * region for a failed save (the shared `FormFieldError` line: icon + `text-danger`, never colour
 * alone). The switch's `aria-describedby` joins the description and the error. Saving is the
 * caller's job — this only shows the position it is given (`checked`), busy (`pending`) or not.
 */
function SwitchField({
  id,
  label,
  checked,
  onCheckedChange,
  ariaLabel,
  description,
  error,
  disabled = false,
  pending = false,
}: {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (next: boolean) => void
  /** An accessible name that starts with the visible label (e.g. "… cho {name}" in a table row). */
  ariaLabel?: string
  description?: React.ReactNode
  error?: string | null
  disabled?: boolean
  /** The save is running: `aria-busy`, and the switch ignores new flips (the caller decides). */
  pending?: boolean
}) {
  const descriptionId = description ? `${id}-description` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div data-slot="switch-field" className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <Switch
          id={id}
          checked={checked}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-busy={pending || undefined}
          aria-describedby={describedBy}
          onCheckedChange={onCheckedChange}
        />
        <Label htmlFor={id}>{label}</Label>
      </div>
      {description && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      <div role="alert">{error && <FormFieldError id={errorId}>{error}</FormFieldError>}</div>
    </div>
  )
}

export { SwitchField }
