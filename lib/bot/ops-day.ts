/**
 * The ops day (§6.2, ADR-0027): run keys are dated in Asia/Ho_Chi_Minh, the main audience's zone,
 * not in UTC — `run_<YYYY-MM-DD>`. Pure (`Intl` only, `now` is a parameter), so `/admin`'s view
 * models use it too.
 */
import type { LocalDay } from '@/lib/domain/time/localDay'

export const OPS_TIMEZONE = 'Asia/Ho_Chi_Minh'

const FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: OPS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** The Vietnamese date of `now` as `YYYY-MM-DD` (it turns at 17:00 UTC). */
export function opsDay(now: Date): LocalDay {
  const parts = Object.fromEntries(FORMAT.formatToParts(now).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
