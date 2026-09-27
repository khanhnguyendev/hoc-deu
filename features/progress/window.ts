/**
 * How far back the learner's `daily_activity` is read (Part B-M5 decision 7; data review M-5, UI
 * m-7): one window for the streak, shared by `/today` and `/progress`, so both pages count the
 * same streak; the heatmap shows the last 53 weeks of it (decision 24). Pure.
 */
import { addDays, type LocalDay } from '@/lib/domain/time/localDay'

/** The streak's window: `daily_activity` from this many days before today, through today. */
export const STREAK_WINDOW_DAYS = 400

/** The heatmap's window (decision 24): 53 weeks, today included. */
export const HEATMAP_DAYS = 53 * 7

/** The first local day `/today` and `/progress` read: `STREAK_WINDOW_DAYS` before `today`. */
export function activityWindowStart(today: LocalDay): LocalDay {
  return addDays(today, -STREAK_WINDOW_DAYS)
}
