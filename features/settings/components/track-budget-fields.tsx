'use client'

import { useId } from 'react'
import { FormField, FormFieldError } from '@/components/patterns/form-field'
import { Input } from '@/components/ui/input'
import { VariantPicker } from '@/features/tracks'
import type { TrackOption } from '@/lib/content/track-options'
import { BUDGET_MINUTES } from '@/lib/domain/settings'
import { variantLabel } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { parseBudgetMinutes } from '../schema'

const copy = vi.settings.tracks

type TrackBudgetFieldsProps = {
  track: Pick<TrackOption, 'id' | 'roadmaps'>
  /** The minutes field as typed. */
  minutes: string
  onMinutesChange: (minutes: string) => void
  variant: string
  onVariantChange: (variant: string) => void
  /** The budget the simulated finish uses while the typed minutes are not a valid budget. */
  fallbackMinutes: number
  /** The action's field errors (`budgetMinutes`, `roadmapVariant`). */
  errors: Record<string, string>
}

/**
 * A track's minutes per day and roadmap variant inside a settings form (named `budgetMinutes` and
 * `roadmapVariant`): the variant as a VariantPicker with the simulated finish (§5.11) when the
 * track has more than one roadmap, else as text. Used by TrackSettings and AddTrackForm.
 */
function TrackBudgetFields({
  track,
  minutes,
  onMinutesChange,
  variant,
  onVariantChange,
  fallbackMinutes,
  errors,
}: TrackBudgetFieldsProps) {
  const uid = useId()
  const variantLabelId = `${uid}-variant`
  const variantErrorId = `${uid}-variant-error`
  const variantError = errors.roadmapVariant

  return (
    <>
      <FormField
        id={`${uid}-minutes`}
        label={copy.minutes}
        description={copy.minutesHelper}
        error={errors.budgetMinutes}
      >
        {(control) => (
          <Input
            {...control}
            name="budgetMinutes"
            type="number"
            inputMode="numeric"
            min={BUDGET_MINUTES.min}
            max={BUDGET_MINUTES.max}
            step={BUDGET_MINUTES.step}
            value={minutes}
            onChange={(event) => onMinutesChange(event.target.value)}
            className="max-w-40"
          />
        )}
      </FormField>
      <div data-slot="track-budget-variant" className="flex flex-col gap-2">
        <p id={variantLabelId} className="text-sm font-medium">
          {copy.variant}
        </p>
        {track.roadmaps.length > 1 ? (
          <VariantPicker
            trackId={track.id}
            name="roadmapVariant"
            roadmaps={track.roadmaps}
            budgetMinutes={parseBudgetMinutes(minutes) ?? fallbackMinutes}
            value={variant}
            onValueChange={onVariantChange}
            aria-labelledby={variantLabelId}
            aria-describedby={variantError === undefined ? undefined : variantErrorId}
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{variantLabel(variant)}</p>
            <input type="hidden" name="roadmapVariant" value={variant} />
          </>
        )}
        {variantError !== undefined && (
          <FormFieldError id={variantErrorId}>{variantError}</FormFieldError>
        )}
      </div>
    </>
  )
}

export { TrackBudgetFields }
export type { TrackBudgetFieldsProps }
