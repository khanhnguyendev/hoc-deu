/**
 * Schedule versions as settings sees them (§5.9, decision 5): the schedule in force now and the
 * next version, if one is pending. Client-safe (the pure domain and the strings), so the page's
 * loader, the action and the form agree on both.
 */
import { scheduleAt, type Schedule, type ScheduleVersion } from '@/lib/domain/time/localDay'
import { formatDayTimeIn } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'

export const sameSchedule = (a: Schedule, b: Schedule): boolean =>
  a.timezone === b.timezone && a.dayStartsAt === b.dayStartsAt

/**
 * The schedule in force at `now` and the next version after it (`pending`), with `effectiveAt`
 * as ISO-8601 UTC. A pending version is replaced by the next change until it takes effect, since
 * every change before then targets the same next day start.
 */
export function scheduleState(
  versions: readonly ScheduleVersion[],
  now: Date,
): { schedule: Schedule; pending: ScheduleVersion | null } {
  let pending: ScheduleVersion | null = null
  for (const version of versions) {
    const at = new Date(version.effectiveAt).getTime()
    if (at > now.getTime() && (pending === null || at < new Date(pending.effectiveAt).getTime())) {
      pending = version
    }
  }
  return {
    schedule: scheduleAt(versions, now),
    pending:
      pending === null
        ? null
        : {
            timezone: pending.timezone,
            dayStartsAt: pending.dayStartsAt,
            effectiveAt: new Date(pending.effectiveAt).toISOString(),
          },
  }
}

/**
 * "Thay đổi áp dụng từ {day} lúc {time} (giờ {timezone}) — …": when a change takes effect, on the
 * clock of the zone in force (§5.9).
 */
export function pendingNotice(effectiveAt: string, timezoneInForce: string): string {
  const { day, time } = formatDayTimeIn(effectiveAt, timezoneInForce)
  return vi.settings.schedule.pending
    .replace('{day}', day)
    .replace('{time}', time)
    .replace('{timezone}', timezoneInForce)
}
