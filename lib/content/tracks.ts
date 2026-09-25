/**
 * The track manifests (platform design §3.4, §3.8): read from the generated catalog (decision 6),
 * where `content:build` validated them once — no YAML at runtime, no file tracing. A new track
 * appears in onboarding and settings when its manifest lands with `status: active`.
 */
import 'server-only'
import { getCatalog } from './catalog'
import type { TrackManifest } from './schemas/manifest'

/**
 * A track by id, including `draft` and `retired` ones, or `null` when it does not exist: the
 * catalog's own lookup, not a second scan.
 */
export { getTrack } from './catalog'

/** Every track, drafts and retired ones included, sorted by ID. */
export function loadTracks(): readonly TrackManifest[] {
  return getCatalog().tracks
}

/** Tracks with `status: active` — the only ones a learner may enroll in. */
export function activeTracks(): readonly TrackManifest[] {
  return loadTracks().filter((track) => track.status === 'active')
}
