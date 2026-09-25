import 'server-only'
import { requireActive } from '@/lib/auth/dal'
import { loadTrackOptions, type TrackOption } from '@/lib/content/track-options'
import { timeZoneOptions } from '@/lib/domain/time/timeZones'

export type OnboardingData = {
  tracks: TrackOption[]
  /** Canonical IANA ids, from the server's ICU: the browser's list may differ (decision 6). */
  timeZones: readonly string[]
  /** The server's clock (ISO-8601): today and the start-date range are computed from it. */
  now: string
  /** A fresh UUID per render (decision 9): every event id of the submit derives from it. */
  requestId: string
}

/**
 * Everything the onboarding wizard needs (§2.4). The time-zone list is built here, never in the
 * browser during render, so the server and the client render the same options.
 */
export async function getOnboardingData(): Promise<OnboardingData> {
  await requireActive()
  return {
    tracks: loadTrackOptions(),
    timeZones: timeZoneOptions(),
    now: new Date().toISOString(),
    requestId: crypto.randomUUID(),
  }
}
