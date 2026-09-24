'use client'

import { useId, useState } from 'react'
import { Banner } from '@/components/patterns/banner'
import { FormActions } from '@/components/patterns/form-actions'
import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { DAY_STARTS, type Schedule } from '@/lib/domain/time/localDay'
import { vi } from '@/lib/i18n/vi'
import { pendingNotice, sameSchedule } from '../schedule'
import type { SettingsAction } from '../schema'
import { failureOf, fieldErrorsOf, useSettingsAction } from './use-settings-action'

const copy = vi.settings.schedule

type ScheduleFormProps = {
  /** The schedule in force now. */
  schedule: Schedule
  /** The next version, when a change is pending (§5.9). */
  pendingSchedule: (Schedule & { effectiveAt: string }) | null
  /** Canonical time-zone ids from the server (`timeZoneOptions()`), never built in the browser. */
  timeZones: readonly string[]
  /** The page's per-render UUID (decision 9). */
  requestId: string
  updateSchedule: SettingsAction
}

/**
 * Time zone and day start (§2.4, §5.9). The fields show the pending change when there is one —
 * that is what a save is compared with — and a notice says when it takes effect, on the clock of
 * the zone in force. The values follow the saved ones whenever the page re-renders.
 */
function ScheduleForm({
  schedule,
  pendingSchedule,
  timeZones,
  requestId,
  updateSchedule,
}: ScheduleFormProps) {
  const uid = useId()
  const saved: Schedule = pendingSchedule ?? schedule
  const [values, setValues] = useState<Schedule>(saved)
  const [shown, setShown] = useState<Schedule>(saved)
  // The page re-rendered with other saved values: show them (adjusting state while rendering).
  if (!sameSchedule(shown, saved)) {
    setShown(saved)
    setValues(saved)
  }
  const { result, pending, onSubmit } = useSettingsAction(updateSchedule)
  const errors = fieldErrorsOf(result)
  const failure = failureOf(result)
  // A saved zone the list lacks is still listed, so the select never shows another zone.
  const zones = timeZones.includes(values.timezone) ? timeZones : [values.timezone, ...timeZones]

  return (
    <form
      data-slot="schedule-form"
      aria-label={copy.title}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4"
    >
      {pendingSchedule && (
        <Banner tone="info">{pendingNotice(pendingSchedule.effectiveAt, schedule.timezone)}</Banner>
      )}
      <input type="hidden" name="requestId" value={requestId} />
      <div className="grid gap-4 md:grid-cols-2">
        <FormField id={`${uid}-timezone`} label={copy.timezone} error={errors.timezone}>
          {(control) => (
            <NativeSelect
              {...control}
              name="timezone"
              value={values.timezone}
              onChange={(event) => setValues({ ...values, timezone: event.target.value })}
            >
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField
          id={`${uid}-day-start`}
          label={copy.dayStart}
          description={copy.dayStartHelper}
          error={errors.dayStartsAt}
        >
          {(control) => (
            <NativeSelect
              {...control}
              name="dayStartsAt"
              value={values.dayStartsAt}
              onChange={(event) => setValues({ ...values, dayStartsAt: event.target.value })}
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
      <FormActions error={failure}>
        <Button type="submit" loading={pending}>
          {copy.save}
        </Button>
      </FormActions>
    </form>
  )
}

export { ScheduleForm }
export type { ScheduleFormProps }
