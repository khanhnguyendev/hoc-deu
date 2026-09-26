/**
 * Event keys for `completeOnboarding` (§2.4, M2 RF-2 "digest keys" minor). `deriveEventId` mixes
 * each key with the page's `requestId`, so a double submit or a retry within one render sends the
 * same id and the database records the event once. Before this, a key such as
 * `track.enrolled:dsa` carried no digest of the fields it enrolled the track with: an edited
 * resubmit after a partial failure (a different budget, picked after reading the first error) sent
 * the very same id, so `apply_event` recorded it as a no-op `duplicate` and kept the first
 * submission's values. Mixing a digest of the chosen fields into the key makes a changed value a
 * different event, so the retry's own values are the ones that land.
 *
 * Not `server-only`: no secrets, and a "use server" module may only export async functions, so
 * `completeOnboarding` (`./actions.ts`) imports these as a plain module instead.
 */
import { digest } from '@/lib/events/ids'

/** The schedule fields the learner chose (never the derived `effectiveAt`, decision 5). */
export const scheduleKey = (fields: { timezone: string; dayStartsAt: string }): string =>
  `schedule.changed:${digest(fields)}`

export const settingsKey = (codeLanguage: string): string =>
  `settings.changed:${digest({ codeLanguage })}`

/**
 * `currentStatus` is the track's `user_tracks` row status as read *before* this event (`null`
 * when never enrolled) — not a chosen field, but it must still be part of the digest: a track
 * removed by the orphan cleanup (below) earlier in the same render, then re-selected with the
 * exact same fields, would otherwise key identically to its first enrollment and read back as a
 * no-op `duplicate`, leaving the row `removed` (M2 minor, an A→B→A selection within one render).
 */
export const trackEnrolledKey = (
  trackId: string,
  fields: {
    roadmapVariant: string
    budgetMinutes: number
    startDate: string
    currentStatus: 'active' | 'paused' | 'removed' | null
  },
): string => `track.enrolled:${trackId}:${digest(fields)}`

/** An orphan enrollment the final selection dropped (no chosen fields to digest). */
export const trackRemovedKey = (trackId: string): string => `track.removed:${trackId}`
