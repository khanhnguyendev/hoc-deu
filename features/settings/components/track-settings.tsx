'use client'

import { Route, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Banner } from '@/components/patterns/banner'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { EmptyState } from '@/components/patterns/empty-state'
import { FormActions } from '@/components/patterns/form-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { WeeklyTemplatePreview } from '@/features/tracks'
import { withTitle } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { cn } from '@/lib/utils'
import type { Enrollment, SettingsAction, SettingsResult, SettingsTrack } from '../schema'
import { TrackBudgetFields } from './track-budget-fields'
import { failureOf, fieldErrorsOf, useSettingsAction } from './use-settings-action'

const copy = vi.settings.tracks

/** Every entry in the list — a track's own section or an orphaned failure — shares this rule. */
const ROW = 'border-t border-border pt-8 first:border-t-0 first:pt-0'

type TrackSettingsProps = {
  /** Every active track with the learner's enrollment; only active and paused ones are shown. */
  tracks: SettingsTrack[]
  /** The page's per-render UUID (decision 9). */
  requestId: string
  updateTrack: SettingsAction
  setTrackStatus: SettingsAction
}

type Shown = SettingsTrack & { enrollment: Enrollment & { status: 'active' | 'paused' } }

const isShown = (track: SettingsTrack): track is Shown =>
  track.enrollment !== null && track.enrollment.status !== 'removed'

/**
 * The learner's tracks (§2.4, §5.9): each active or paused track with its status, minutes per
 * day and roadmap variant (with the simulated finish, §5.11), its weekly template and throttle
 * read-only (editing is later, §0), and pause / resume / remove. After a removal the list takes
 * keyboard focus, since the removed track's buttons are gone.
 *
 * A status change's failure lives here, keyed by track id — not inside the row itself (M2 minor):
 * a `track_not_enrolled` or `invalid_transition` failure re-renders the page (§4.1's stale re-fetch),
 * and when the fresh data no longer lists the track (someone else changed it first), the row that
 * held the failure is gone with it. The message survives that as a standalone line with the
 * track's last known title, so the learner still sees why nothing happened.
 */
function TrackSettings({ tracks, requestId, updateTrack, setTrackStatus }: TrackSettingsProps) {
  const shown = tracks.filter(isShown)
  const shownIds = new Set(shown.map((track) => track.option.id))
  const listRef = useRef<HTMLDivElement>(null)
  /** The track whose removal was asked for: once it has left the list, the list takes focus. */
  const removing = useRef<string | null>(null)
  const ids = shown.map((track) => track.option.id).join(' ')

  const [failures, setFailures] = useState<Record<string, { title: string; message: string }>>({})
  const clearFailure = (trackId: string) =>
    setFailures((current) => {
      if (!(trackId in current)) return current
      const next = { ...current }
      delete next[trackId]
      return next
    })
  const reportStatusResult = (trackId: string, title: string, result: SettingsResult) => {
    if (result.ok) clearFailure(trackId)
    else setFailures((current) => ({ ...current, [trackId]: { title, message: result.message } }))
  }
  const orphaned = Object.entries(failures).filter(([trackId]) => !shownIds.has(trackId))

  useEffect(() => {
    const target = removing.current
    removing.current = null
    if (target !== null && !ids.split(' ').includes(target)) listRef.current?.focus()
  }, [ids])

  return (
    <div
      ref={listRef}
      tabIndex={-1}
      data-slot="track-settings"
      className="flex flex-col gap-8 rounded-lg"
    >
      {shown.length === 0 && orphaned.length === 0 ? (
        <EmptyState
          icon={Route}
          title={copy.emptyTitle}
          description={copy.emptyBody}
          titleAs="h3"
        />
      ) : (
        <>
          {shown.map((track) => (
            <TrackRow
              key={track.option.id}
              track={track}
              requestId={requestId}
              updateTrack={updateTrack}
              setTrackStatus={setTrackStatus}
              onStatusResult={(result) =>
                reportStatusResult(track.option.id, track.option.title, result)
              }
              onRemove={() => {
                removing.current = track.option.id
              }}
            />
          ))}
          {orphaned.map(([trackId, entry]) => (
            <section key={trackId} className={cn(ROW, 'flex flex-col gap-2')}>
              <h3 className="text-lg font-semibold">{entry.title}</h3>
              <div role="alert">
                <Banner
                  tone="danger"
                  action={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={vi.common.close}
                      onClick={() => clearFailure(trackId)}
                    >
                      <X aria-hidden="true" strokeWidth={1.75} />
                    </Button>
                  }
                >
                  {entry.message}
                </Banner>
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  )
}

function TrackRow({
  track: { option, enrollment },
  requestId,
  updateTrack,
  setTrackStatus,
  onStatusResult,
  onRemove,
}: {
  track: Shown
  requestId: string
  updateTrack: SettingsAction
  setTrackStatus: SettingsAction
  onStatusResult: (result: SettingsResult) => void
  onRemove: () => void
}) {
  const uid = useId()
  const headingId = `${uid}-title`

  const saved = { minutes: String(enrollment.budgetMinutes), variant: enrollment.roadmapVariant }
  const [minutes, setMinutes] = useState(saved.minutes)
  const [variant, setVariant] = useState(saved.variant)
  const [synced, setSynced] = useState(saved)
  // The page re-rendered with other saved values: show them (adjusting state while rendering).
  if (synced.minutes !== saved.minutes || synced.variant !== saved.variant) {
    setSynced(saved)
    setMinutes(saved.minutes)
    setVariant(saved.variant)
  }

  const { result, pending, onSubmit } = useSettingsAction(updateTrack)
  const errors = fieldErrorsOf(result)
  const updateFailure = failureOf(result)

  return (
    <section
      data-accent={option.accent}
      aria-labelledby={headingId}
      className={cn(ROW, 'flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6')}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={headingId} className="text-lg font-semibold">
            {option.title}
          </h3>
          <Badge tone={enrollment.status === 'active' ? 'success' : 'warning'}>
            {copy.status[enrollment.status]}
          </Badge>
        </div>
        <form
          aria-labelledby={headingId}
          onSubmit={onSubmit}
          noValidate
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="trackId" value={option.id} />
          <TrackBudgetFields
            track={option}
            minutes={minutes}
            onMinutesChange={setMinutes}
            variant={variant}
            onVariantChange={setVariant}
            fallbackMinutes={enrollment.budgetMinutes}
            errors={errors}
          />
          <FormActions error={updateFailure}>
            <Button type="submit" loading={pending}>
              {copy.save}
            </Button>
          </FormActions>
        </form>
        <TrackStatusActions
          trackId={option.id}
          title={option.title}
          status={enrollment.status}
          requestId={requestId}
          setTrackStatus={setTrackStatus}
          onStatusResult={onStatusResult}
          onRemove={onRemove}
        />
      </div>
      <WeeklyTemplatePreview
        title={copy.templateTitle}
        accent={option.accent}
        days={option.template}
        throttle={option.throttle}
      />
    </section>
  )
}

type Slot = 'toggle' | 'remove'

/**
 * "Tạm dừng" / "Tiếp tục" (one button, keyed by its slot, so it stays the same element — and
 * keeps focus — when the status flips) and "Gỡ lộ trình", which asks first. Runs through
 * `useSettingsAction` (`useActionState`, same as every other settings form): a plain `async`
 * `send` with its own `pending` state (an earlier version of this fix used) has no
 * `try`/`finally`, so a rejected action leaves `pending` stuck `true` forever — the buttons and
 * the confirm dialog then never recover. The action passed in wraps `setTrackStatus` to also
 * report its result to the list (`onStatusResult`), which keeps a failure alive even if this row
 * disappears (M2 minor): a stale re-render can remove the track from the list before the learner
 * has read why the change failed.
 */
function TrackStatusActions({
  trackId,
  title,
  status,
  requestId,
  setTrackStatus,
  onStatusResult,
  onRemove,
}: {
  trackId: string
  title: string
  status: 'active' | 'paused'
  requestId: string
  setTrackStatus: SettingsAction
  onStatusResult: (result: SettingsResult) => void
  onRemove: () => void
}) {
  const withResultReported: SettingsAction = async (previous, formData) => {
    const result = await setTrackStatus(previous, formData)
    onStatusResult(result)
    return result
  }
  const { result, pending, run } = useSettingsAction(withResultReported)
  const [running, setRunning] = useState<Slot | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [handled, setHandled] = useState(result)
  // A new result: the removal (if that was it) is over, so the dialog closes.
  if (result !== handled) {
    setHandled(result)
    setConfirming(false)
  }
  const failure = failureOf(result)

  const send = (to: 'paused' | 'active' | 'removed') => {
    const data = new FormData()
    data.set('requestId', requestId)
    data.set('trackId', trackId)
    data.set('to', to)
    setRunning(to === 'removed' ? 'remove' : 'toggle')
    if (to === 'removed') onRemove()
    run(data)
  }

  return (
    <>
      <FormActions error={failure} label={withTitle(copy.actionsFor, title)}>
        <Button
          key="toggle"
          variant="outline"
          loading={pending && running === 'toggle'}
          disabled={pending && running !== 'toggle'}
          onClick={() => send(status === 'active' ? 'paused' : 'active')}
        >
          {status === 'active' ? copy.pause : copy.resume}
        </Button>
        <Button
          key="remove"
          variant="outline"
          loading={pending && running === 'remove'}
          disabled={pending && running !== 'remove'}
          onClick={() => setConfirming(true)}
        >
          {copy.remove}
        </Button>
      </FormActions>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={withTitle(copy.confirmRemove.title, title)}
        description={copy.confirmRemove.description}
        confirmLabel={copy.remove}
        tone="destructive"
        pending={pending}
        onConfirm={() => send('removed')}
      />
    </>
  )
}

export { TrackSettings }
export type { TrackSettingsProps }
