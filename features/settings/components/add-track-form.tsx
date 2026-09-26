'use client'

import { Route } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { ChoiceCard } from '@/components/patterns/choice-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { FormActions } from '@/components/patterns/form-actions'
import { FormField } from '@/components/patterns/form-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { defaultVariant } from '@/lib/domain/plan/variant'
import { MAX_START_DAYS_AHEAD } from '@/lib/domain/settings'
import { addDays, localDay, type Schedule } from '@/lib/domain/time/localDay'
import { formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { parseBudgetMinutes, type SettingsAction, type SettingsTrack } from '../schema'
import { TrackBudgetFields } from './track-budget-fields'
import { failureOf, fieldErrorsOf, useSettingsAction } from './use-settings-action'

const copy = vi.settings.add

type AddTrackFormProps = {
  /** Every active track with the learner's enrollment; removed and never-enrolled ones are offered. */
  tracks: SettingsTrack[]
  /** The schedule in force: today and the start-date range are computed in it. */
  schedule: Schedule
  /** The server's clock (ISO-8601). */
  now: string
  /** The page's per-render UUID (decision 9). */
  requestId: string
  enrollTrack: SettingsAction
}

const isCandidate = (track: SettingsTrack) =>
  track.enrollment === null || track.enrollment.status === 'removed'

/**
 * "Thêm lộ trình" (§2.4, §5.9): one form for the active tracks the learner does not study — never
 * enrolled, or removed ("Đã gỡ": re-adding keeps the history). A removed track starts from its
 * last minutes and variant; a new one from the track's default minutes, with the variant following
 * the minutes (ADR-0015) until the learner picks one. The start date is today by default, up to
 * 60 days ahead (decision 22).
 */
function AddTrackForm({ tracks, schedule, now, requestId, enrollTrack }: AddTrackFormProps) {
  const uid = useId()
  const candidates = tracks.filter(isCandidate)
  const today = localDay(new Date(now), schedule)
  const [pickedTrack, setPickedTrack] = useState<string | null>(null)
  const [typedMinutes, setTypedMinutes] = useState<Record<string, string>>({})
  const [pickedVariants, setPickedVariants] = useState<Record<string, string>>({})
  const [pickedStartDate, setPickedStartDate] = useState<string | null>(null)
  const { result, pending, onSubmit } = useSettingsAction(enrollTrack)
  // The last result belongs to the track it was submitted for — never the candidate now picked,
  // if that has since changed (M2 minor): switching the radio clears the previous candidate's
  // server errors and pending state instead of showing them against the new one's fields.
  const [submittedTrackId, setSubmittedTrackId] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  /** The track being added: when it leaves the list and focus went with the form, focus moves here. */
  const adding = useRef<string | null>(null)
  const ids = candidates.map((track) => track.option.id).join(' ')
  useEffect(() => {
    const target = adding.current
    adding.current = null
    const lost = document.activeElement === null || document.activeElement === document.body
    if (target !== null && !ids.split(' ').includes(target) && lost) containerRef.current?.focus()
  }, [ids])

  const selected =
    candidates.find((track) => track.option.id === pickedTrack) ?? candidates[0] ?? null
  const forCurrentTrack = selected !== null && submittedTrackId === selected.option.id
  const errors = forCurrentTrack ? fieldErrorsOf(result) : {}
  const failure = forCurrentTrack ? failureOf(result) : null
  const isPending = forCurrentTrack && pending

  /** A track's fields: as typed or picked, else its last (removed) or default values. */
  function fieldsOf({ option, enrollment }: SettingsTrack) {
    const fallbackMinutes = enrollment?.budgetMinutes ?? option.defaultBudgetMinutes
    const minutes = typedMinutes[option.id] ?? String(fallbackMinutes)
    const lastVariant = option.roadmaps.find((roadmap) => roadmap.id === enrollment?.roadmapVariant)
    const variant =
      pickedVariants[option.id] ??
      lastVariant?.id ??
      defaultVariant(option.roadmaps, parseBudgetMinutes(minutes) ?? fallbackMinutes)
    return { fallbackMinutes, minutes, variant }
  }

  return (
    <div ref={containerRef} tabIndex={-1} data-slot="add-track-form" className="rounded-lg">
      {selected === null ? (
        <EmptyState icon={Route} title={copy.emptyTitle} titleAs="h3" />
      ) : (
        <form
          aria-label={copy.title}
          onSubmit={(event) => {
            adding.current = selected.option.id
            setSubmittedTrackId(selected.option.id)
            onSubmit(event)
          }}
          noValidate
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="requestId" value={requestId} />
          <RadioGroup
            name="trackId"
            aria-label={copy.track}
            value={selected.option.id}
            onValueChange={setPickedTrack}
            className="gap-3"
          >
            {candidates.map(({ option, enrollment }) => (
              <div key={option.id} data-accent={option.accent}>
                <ChoiceCard
                  htmlFor={`${uid}-${option.id}`}
                  control={
                    <RadioGroupItem
                      id={`${uid}-${option.id}`}
                      value={option.id}
                      className="mt-0.5"
                    />
                  }
                  title={option.title}
                  description={
                    enrollment === null ? (
                      <Badge tone="track">
                        {vi.onboarding.tracks.suggested.replace(
                          '{minutes}',
                          formatNumber(option.defaultBudgetMinutes),
                        )}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">{copy.removed}</Badge>
                    )
                  }
                />
              </div>
            ))}
          </RadioGroup>
          <TrackBudgetFields
            track={selected.option}
            {...fieldsOf(selected)}
            onMinutesChange={(value) =>
              setTypedMinutes((current) => ({ ...current, [selected.option.id]: value }))
            }
            onVariantChange={(value) =>
              setPickedVariants((current) => ({ ...current, [selected.option.id]: value }))
            }
            errors={errors}
          />
          <FormField
            id={`${uid}-start-date`}
            label={copy.startDate}
            description={copy.startDateHelper}
            error={errors.startDate}
          >
            {(control) => (
              <Input
                {...control}
                name="startDate"
                type="date"
                min={today}
                max={addDays(today, MAX_START_DAYS_AHEAD)}
                value={pickedStartDate ?? today}
                onChange={(event) => setPickedStartDate(event.target.value)}
                className="max-w-56"
              />
            )}
          </FormField>
          <FormActions error={failure}>
            <Button type="submit" loading={isPending}>
              {copy.submit}
            </Button>
          </FormActions>
        </form>
      )}
    </div>
  )
}

export { AddTrackForm }
export type { AddTrackFormProps }
