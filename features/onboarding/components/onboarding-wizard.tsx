'use client'

import { MapIcon } from 'lucide-react'
import { useActionState, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import type * as React from 'react'
import { ChoiceCard } from '@/components/patterns/choice-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { FormErrorSummary } from '@/components/patterns/form-error-summary'
import { FormField, FormFieldError } from '@/components/patterns/form-field'
import { StepIndicator } from '@/components/patterns/step-indicator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { VariantPicker, WeeklyTemplatePreview } from '@/features/tracks'
import { CODE_LANGUAGES, type CodeLanguage } from '@/lib/content/schemas/common'
import type { TrackOption } from '@/lib/content/track-options'
import { defaultVariant } from '@/lib/domain/plan/variant'
import { BUDGET_MINUTES, isBudgetMinutes, MAX_START_DAYS_AHEAD } from '@/lib/domain/settings'
import {
  addDays,
  DAY_STARTS,
  DEFAULT_SCHEDULE,
  daysBetween,
  isDayStart,
  isLocalDay,
  localDay,
} from '@/lib/domain/time/localDay'
import { canonicalTimeZone, isValidTimeZone } from '@/lib/domain/time/timeZones'
import { formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { trackFieldKey, type OnboardingInput, type OnboardingState } from '../schema'

type StepKey = 'tracks' | 'minutes' | 'variant' | 'schedule' | 'language' | 'preview'

const STEP_ORDER: readonly StepKey[] = [
  'tracks',
  'minutes',
  'variant',
  'schedule',
  'language',
  'preview',
]
const IDLE: OnboardingState = { status: 'idle' }
const copy = vi.onboarding
const messages = copy.errors

type OnboardingWizardProps = {
  tracks: TrackOption[]
  /** Canonical time-zone ids from the server (`timeZoneOptions()`), never built in the browser. */
  timeZones: readonly string[]
  /** The server's clock (ISO-8601): today and the start-date range come from it. */
  now: string
  /** The page's per-render UUID (decision 9), sent in the payload. */
  requestId: string
  action: (state: OnboardingState, formData: FormData) => Promise<OnboardingState>
  /** The action state to start from — the catalog renders the error state with it. */
  initialState?: OnboardingState
}

/** The step that holds a field, by its error key (`trackFieldKey` or a top-level field). */
function stepOfField(key: string): StepKey {
  if (key === 'tracks') return 'tracks'
  if (key.endsWith('.budgetMinutes')) return 'minutes'
  if (key.endsWith('.roadmapVariant')) return 'variant'
  if (key === 'startDate' || key === 'timezone' || key === 'dayStartsAt') return 'schedule'
  if (key === 'codeLanguage') return 'language'
  return 'preview'
}

const stepRank = (step: StepKey) => STEP_ORDER.indexOf(step)

/** Whole minutes as typed, or NaN for anything that is not a plain number. */
const parseMinutes = (text: string | undefined) =>
  text !== undefined && /^\d+$/.test(text.trim()) ? Number(text) : Number.NaN

// The browser's zone is read after hydration (the server snapshot is null), so the first render
// matches the server's and then switches to the browser's zone when the list has it (decision 6).
const noSubscription = () => () => {}
const browserTimeZone = () => canonicalTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
const serverTimeZone = () => null

/**
 * The onboarding wizard (§2.4): tracks → minutes per track → roadmap variant (defaulted from the
 * minutes, with the simulated finish, §5.11) → start date, time zone, day start → code language →
 * weekly template preview. Every choice stays in this component; one hidden `payload` field
 * carries the whole `OnboardingInput` to the action with the page's `requestId` (decision 9).
 * Each step is checked before moving on, and focus moves to the step heading on every step
 * change. Server errors appear in the summary at the top (DESIGN_SYSTEM §5) and the wizard
 * returns to the step of the first field in error.
 */
function OnboardingSteps({
  tracks,
  timeZones,
  now,
  requestId,
  action,
  initialState = IDLE,
}: OnboardingWizardProps) {
  const uid = useId()
  const [state, formAction, pending] = useActionState(action, initialState)

  const [selected, setSelected] = useState<readonly string[]>([])
  const [minutes, setMinutes] = useState<Record<string, string>>(() =>
    Object.fromEntries(tracks.map((track) => [track.id, String(track.defaultBudgetMinutes)])),
  )
  // Only the learner's own picks: until then a track's variant follows its minutes (ADR-0015).
  const [pickedVariants, setPickedVariants] = useState<Record<string, string>>({})
  const [pickedStartDate, setPickedStartDate] = useState<string | null>(null)
  const [pickedTimeZone, setPickedTimeZone] = useState<string | null>(null)
  const [dayStartsAt, setDayStartsAt] = useState(DEFAULT_SCHEDULE.dayStartsAt)
  const [codeLanguage, setCodeLanguage] = useState<CodeLanguage>('python')
  const [step, setStep] = useState<StepKey>('tracks')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [handledState, setHandledState] = useState<OnboardingState>(IDLE)
  // A repeated identical server error must still re-focus and re-announce the summary (M2 minor):
  // counts real submissions, not renders, so FormErrorSummary's key changes even when the errors
  // read the same as last time.
  const [submitCount, setSubmitCount] = useState(0)

  const headingRef = useRef<HTMLHeadingElement>(null)
  /** Set by the navigation handlers: the element to focus once the new step has rendered. */
  const focusAfterStep = useRef<'heading' | string | null>(null)

  const detectedZone = useSyncExternalStore(noSubscription, browserTimeZone, serverTimeZone)
  const timezone =
    pickedTimeZone ??
    (detectedZone !== null && timeZones.includes(detectedZone)
      ? detectedZone
      : DEFAULT_SCHEDULE.timezone)
  const today = localDay(new Date(now), {
    timezone: isValidTimeZone(timezone) ? timezone : DEFAULT_SCHEDULE.timezone,
    dayStartsAt: isDayStart(dayStartsAt) ? dayStartsAt : DEFAULT_SCHEDULE.dayStartsAt,
  })
  const latestStart = addDays(today, MAX_START_DAYS_AHEAD)
  const startDate = pickedStartDate ?? today

  const selectedTracks = tracks.filter((track) => selected.includes(track.id))
  const variantTracks = selectedTracks.filter((track) => track.roadmaps.length > 1)
  const languages = CODE_LANGUAGES.filter((language) =>
    selectedTracks.some((track) => track.codeLanguages.includes(language)),
  )
  const language = languages.includes(codeLanguage) ? codeLanguage : languages[0]
  const steps = STEP_ORDER.filter(
    (key) =>
      (key !== 'variant' || variantTracks.length > 0) &&
      (key !== 'language' || languages.length > 0),
  )
  const stepIndex = Math.max(steps.indexOf(step), 0)
  const isLast = step === 'preview'

  const variantOf = (track: TrackOption) =>
    pickedVariants[track.id] ?? defaultVariant(track.roadmaps, parseMinutes(minutes[track.id]))

  // A new action result: show its errors and return to the earliest step holding one. Adjusting
  // state while rendering (not in an effect) keeps the summary and the step in one render.
  if (state !== handledState) {
    setHandledState(state)
    setSubmitCount((count) => count + 1)
    if (state.status === 'error') {
      setErrors(state.fieldErrors)
      setFormError(state.formError)
      const target = Object.keys(state.fieldErrors)
        .map(stepOfField)
        .filter((key) => steps.includes(key))
        .sort((a, b) => stepRank(a) - stepRank(b))[0]
      setStep(target ?? 'preview')
    }
  }

  useEffect(() => {
    const target = focusAfterStep.current
    focusAfterStep.current = null
    if (target === 'heading') headingRef.current?.focus()
    else if (target !== null) document.getElementById(target)?.focus()
  }, [step])

  const id = {
    heading: `${uid}-heading`,
    track: (trackId: string) => `${uid}-track-${trackId}`,
    minutes: (trackId: string) => `${uid}-minutes-${trackId}`,
    variant: (trackId: string) => `${uid}-variant-${trackId}`,
    startDate: `${uid}-start-date`,
    timezone: `${uid}-timezone`,
    dayStart: `${uid}-day-start`,
    language: (value: string) => `${uid}-language-${value}`,
    submit: `${uid}-submit`,
    error: (key: string) => `${uid}-error-${key}`,
  }

  /** The element a summary link points at for an error key. */
  function fieldId(key: string): string {
    const [, trackId = '', field] = key.split('.')
    if (key === 'tracks') return id.track(tracks[0]?.id ?? '')
    if (field === 'budgetMinutes') return id.minutes(trackId)
    if (field === 'roadmapVariant') return id.variant(trackId)
    if (key === 'startDate') return id.startDate
    if (key === 'timezone') return id.timezone
    if (key === 'dayStartsAt') return id.dayStart
    if (key === 'codeLanguage') return id.language(languages[0] ?? 'python')
    return id.submit
  }

  /** The current step's problems, keyed like the server's field errors. */
  function validate(key: StepKey): Record<string, string> {
    const found: Record<string, string> = {}
    switch (key) {
      case 'tracks':
        if (selectedTracks.length === 0) found.tracks = messages.noTrack
        break
      case 'minutes':
        for (const track of selectedTracks) {
          if (!isBudgetMinutes(parseMinutes(minutes[track.id]))) {
            found[trackFieldKey(track.id, 'budgetMinutes')] = messages.minutes
          }
        }
        break
      case 'variant':
        for (const track of variantTracks) {
          if (!track.roadmaps.some((roadmap) => roadmap.id === variantOf(track))) {
            found[trackFieldKey(track.id, 'roadmapVariant')] = messages.variant
          }
        }
        break
      case 'schedule':
        if (!isLocalDay(startDate)) found.startDate = messages.startDate
        else if (daysBetween(today, startDate) > MAX_START_DAYS_AHEAD) {
          found.startDate = messages.startDateTooLate
        }
        if (!timeZones.includes(timezone)) found.timezone = messages.timezone
        if (!isDayStart(dayStartsAt)) found.dayStartsAt = messages.dayStart
        break
      case 'language':
        if (language === undefined) found.codeLanguage = messages.codeLanguage
        break
      case 'preview':
        break
    }
    return found
  }

  function goTo(target: StepKey, focus: 'heading' | string = 'heading') {
    focusAfterStep.current = focus
    setFormError(null)
    setStep(target)
  }

  function goNext() {
    const found = validate(step)
    // Keep other steps' errors (from the server) until the learner reaches them.
    const others = Object.fromEntries(
      Object.entries(errors).filter(([key]) => stepOfField(key) !== step),
    )
    setErrors({ ...others, ...found })
    if (Object.keys(found).length > 0) return
    const following = steps[stepIndex + 1]
    if (following !== undefined) goTo(following)
  }

  function goBack() {
    const previous = steps[stepIndex - 1]
    if (previous !== undefined) goTo(previous)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    // Enter in a text field moves on (as "Tiếp tục"); only the last step submits.
    if (event.key !== 'Enter' || isLast || !(event.target instanceof HTMLInputElement)) return
    event.preventDefault()
    goNext()
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (isLast) return
    event.preventDefault()
    goNext()
  }

  /**
   * A summary link's target (§2.10's `onNavigate`): a field on another step opens that step, then
   * focuses the field; a field on the current step is focused directly — never a native anchor
   * jump, which some browsers (and jsdom) do not reliably focus (M2 minor).
   */
  function onNavigate(target: string) {
    const key = [...Object.keys(errors), 'form'].find((candidate) => fieldId(candidate) === target)
    const targetStep = key === undefined ? null : stepOfField(key)
    if (targetStep === null || !steps.includes(targetStep)) return
    if (targetStep === step) {
      document.getElementById(target)?.focus()
      return
    }
    focusAfterStep.current = target
    setStep(targetStep)
  }

  const summary = [
    ...Object.entries(errors)
      .sort(([a], [b]) => stepRank(stepOfField(a)) - stepRank(stepOfField(b)))
      .map(([key, message]) => ({ fieldId: fieldId(key), message })),
    ...(formError === null ? [] : [{ fieldId: id.submit, message: formError }]),
  ]

  const payload: OnboardingInput = {
    requestId,
    tracks: selectedTracks.map((track) => ({
      trackId: track.id,
      budgetMinutes: parseMinutes(minutes[track.id]),
      roadmapVariant: variantOf(track),
    })),
    startDate,
    timezone,
    dayStartsAt,
    ...(language === undefined ? {} : { codeLanguage: language }),
  }

  const toggleTrack = (trackId: string, checked: boolean) =>
    setSelected((current) =>
      checked ? [...current, trackId] : current.filter((selectedId) => selectedId !== trackId),
    )

  const groupError = (key: string) =>
    errors[key] === undefined ? null : (
      <FormFieldError id={id.error(key)}>{errors[key]}</FormFieldError>
    )
  const describedBy = (key: string) => (errors[key] === undefined ? undefined : id.error(key))
  const invalid = (key: string) => (errors[key] === undefined ? undefined : true)

  return (
    <form
      data-slot="onboarding-wizard"
      action={formAction}
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
      noValidate
      className="flex flex-col gap-6"
    >
      {summary.length > 0 && (
        <FormErrorSummary
          title={vi.forms.errorSummaryTitle}
          errors={summary}
          submitCount={submitCount}
          onNavigate={onNavigate}
        />
      )}

      <div className="flex flex-col gap-4">
        <StepIndicator steps={steps.map((key) => copy.steps[key])} current={stepIndex} />
        <div className="flex flex-col gap-1">
          <h2 ref={headingRef} id={id.heading} tabIndex={-1} className="text-xl font-semibold">
            {copy.steps[step]}
          </h2>
          <p className="text-sm text-muted-foreground">{copy[step].description}</p>
        </div>
      </div>

      {step === 'tracks' && (
        <div className="flex flex-col gap-2">
          <div
            role="group"
            aria-labelledby={id.heading}
            aria-describedby={describedBy('tracks')}
            className="flex flex-col gap-3"
          >
            {tracks.map((track) => (
              <div key={track.id} data-accent={track.accent}>
                <ChoiceCard
                  htmlFor={id.track(track.id)}
                  control={
                    <Checkbox
                      id={id.track(track.id)}
                      checked={selected.includes(track.id)}
                      onCheckedChange={(checked) => toggleTrack(track.id, checked === true)}
                      aria-invalid={invalid('tracks')}
                      className="mt-0.5"
                    />
                  }
                  title={track.title}
                  description={
                    <Badge tone="track">
                      {copy.tracks.suggested.replace(
                        '{minutes}',
                        formatNumber(track.defaultBudgetMinutes),
                      )}
                    </Badge>
                  }
                />
              </div>
            ))}
          </div>
          {groupError('tracks')}
        </div>
      )}

      {step === 'minutes' && (
        <div className="flex flex-col gap-4">
          {selectedTracks.map((track) => (
            <FormField
              key={track.id}
              id={id.minutes(track.id)}
              label={track.title}
              description={copy.minutes.helper}
              error={errors[trackFieldKey(track.id, 'budgetMinutes')]}
            >
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  inputMode="numeric"
                  min={BUDGET_MINUTES.min}
                  max={BUDGET_MINUTES.max}
                  step={BUDGET_MINUTES.step}
                  value={minutes[track.id] ?? ''}
                  onChange={(event) =>
                    setMinutes((current) => ({ ...current, [track.id]: event.target.value }))
                  }
                  className="max-w-40"
                />
              )}
            </FormField>
          ))}
        </div>
      )}

      {step === 'variant' && (
        <div className="flex flex-col gap-6">
          {variantTracks.map((track) => {
            const key = trackFieldKey(track.id, 'roadmapVariant')
            return (
              <section
                key={track.id}
                aria-labelledby={id.variant(track.id)}
                className="flex flex-col gap-3"
              >
                <h3 id={id.variant(track.id)} tabIndex={-1} className="font-medium">
                  {track.title}
                </h3>
                <VariantPicker
                  trackId={track.id}
                  name={`variant-${track.id}`}
                  roadmaps={track.roadmaps}
                  budgetMinutes={parseMinutes(minutes[track.id])}
                  value={variantOf(track)}
                  onValueChange={(value) =>
                    setPickedVariants((current) => ({ ...current, [track.id]: value }))
                  }
                  aria-labelledby={id.variant(track.id)}
                />
                {groupError(key)}
              </section>
            )
          })}
        </div>
      )}

      {step === 'schedule' && (
        <div className="flex flex-col gap-4">
          <FormField
            id={id.startDate}
            label={copy.schedule.startDate}
            description={copy.schedule.startDateHelper}
            error={errors.startDate}
          >
            {(control) => (
              <Input
                {...control}
                type="date"
                min={today}
                max={latestStart}
                value={startDate}
                onChange={(event) => setPickedStartDate(event.target.value)}
                className="max-w-56"
              />
            )}
          </FormField>
          <FormField id={id.timezone} label={copy.schedule.timezone} error={errors.timezone}>
            {(control) => (
              <NativeSelect
                {...control}
                value={timezone}
                onChange={(event) => setPickedTimeZone(event.target.value)}
              >
                {timeZones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField
            id={id.dayStart}
            label={copy.schedule.dayStart}
            description={copy.schedule.dayStartHelper}
            error={errors.dayStartsAt}
          >
            {(control) => (
              <NativeSelect
                {...control}
                value={dayStartsAt}
                onChange={(event) => setDayStartsAt(event.target.value)}
              >
                {DAY_STARTS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
        </div>
      )}

      {step === 'language' && (
        <div className="flex flex-col gap-2">
          <RadioGroup
            aria-labelledby={id.heading}
            aria-describedby={describedBy('codeLanguage')}
            value={language}
            onValueChange={(value) => setCodeLanguage(value as CodeLanguage)}
            className="gap-3"
          >
            {languages.map((value) => (
              <ChoiceCard
                key={value}
                htmlFor={id.language(value)}
                control={
                  <RadioGroupItem
                    id={id.language(value)}
                    value={value}
                    aria-invalid={invalid('codeLanguage')}
                    className="mt-0.5"
                  />
                }
                title={copy.language[value]}
              />
            ))}
          </RadioGroup>
          {groupError('codeLanguage')}
        </div>
      )}

      {step === 'preview' && (
        <div className="flex flex-col gap-4">
          {selectedTracks.map((track) => (
            <WeeklyTemplatePreview
              key={track.id}
              title={track.title}
              accent={track.accent}
              days={track.template}
              throttle={track.throttle}
            />
          ))}
          <input type="hidden" name="payload" value={JSON.stringify(payload)} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {stepIndex > 0 && (
          <Button variant="outline" onClick={goBack} disabled={pending}>
            {copy.back}
          </Button>
        )}
        {/* Distinct keys: reusing the clicked "Tiếp tục" <button> as type="submit" would let the
            browser submit the form at the end of that same click. */}
        {isLast ? (
          <Button
            key="submit"
            id={id.submit}
            type="submit"
            size="lg"
            loading={pending}
            className="ml-auto"
          >
            {copy.submit}
          </Button>
        ) : (
          <Button key="next" onClick={goNext} className="ml-auto">
            {copy.next}
          </Button>
        )}
      </div>
    </form>
  )
}

/**
 * The wizard, or — when no track is active, so no step could be completed — an empty state
 * (RF-4). A separate component, so the steps' hooks always run in the same order.
 */
function OnboardingWizard(props: OnboardingWizardProps) {
  if (props.tracks.length === 0) {
    return (
      <EmptyState
        icon={MapIcon}
        title={copy.noTracks.title}
        description={copy.noTracks.description}
      />
    )
  }
  return <OnboardingSteps {...props} />
}

export { OnboardingWizard }
export type { OnboardingWizardProps }
