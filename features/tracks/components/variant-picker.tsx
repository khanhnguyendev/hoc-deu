'use client'

import { useId } from 'react'
import type * as React from 'react'
import { ChoiceCard } from '@/components/patterns/choice-card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { TrackOption } from '@/lib/content/track-options'
import { projectFinish } from '@/lib/domain/plan/projections'
import { formatFinishEstimate, variantLabel } from '@/lib/i18n/format'

type VariantPickerProps = {
  trackId: string
  /** The radio group's form name. */
  name: string
  roadmaps: TrackOption['roadmaps']
  /** The learner's minutes per day: the simulated finish is shown for this budget. */
  budgetMinutes: number
  value: string
  onValueChange: (id: string) => void
  /** Names the group (e.g. the id of the track's heading); the group needs one of the two. */
  'aria-labelledby'?: string
  'aria-label'?: string
  /** The id of an error line under the group (settings, task 2.11). */
  'aria-describedby'?: string
}

/**
 * RadioGroup of the track's roadmaps (`variantLabel`: "8 tuần", "10 tuần") with the simulated
 * finish per choice at the learner's budget (§5.11, ADR-0015) — none for a track without a
 * projection table (English). Each option is a ChoiceCard, so the card is the touch target.
 */
function VariantPicker({
  trackId,
  name,
  roadmaps,
  budgetMinutes,
  value,
  onValueChange,
  ...labelling
}: VariantPickerProps): React.JSX.Element {
  const id = useId()
  return (
    <RadioGroup
      data-slot="variant-picker"
      name={name}
      value={value}
      onValueChange={onValueChange}
      className="gap-3"
      {...labelling}
    >
      {roadmaps.map((roadmap) => {
        const itemId = `${id}-${roadmap.id}`
        const label = variantLabel(roadmap.id)
        const projection = projectFinish(trackId, roadmap.id, budgetMinutes)
        return (
          <ChoiceCard
            key={roadmap.id}
            htmlFor={itemId}
            control={<RadioGroupItem id={itemId} value={roadmap.id} className="mt-0.5" />}
            title={label}
            description={
              projection === null
                ? undefined
                : formatFinishEstimate({ budgetMinutes, variantLabel: label, ...projection })
            }
          />
        )
      })}
    </RadioGroup>
  )
}

export { VariantPicker }
export type { VariantPickerProps }
