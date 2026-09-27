/**
 * A learner's progress on a track's variant (Part B-M3 decision 25): the track page's
 * TrackProgress and `/today`'s per-track cards read the same numbers (UI m-1), so they live here,
 * pure (re-review M9: `/today`'s view model no longer imports a feature's loaders for them).
 */
import { isActiveItem, type PlanCatalog } from '../catalog'
import { own } from '../compare'
import type { ItemState } from '../state'
import { coreItemsOfWeek, roadmapWeek } from './roadmap'

export type TrackProgressData = {
  /** The roadmap week (`roadmapWeek`, §5.3); 1 without a roadmap. */
  readonly week: number
  /** The variant's roadmap weeks; 0 without a roadmap. */
  readonly weeks: number
  /** Introduced active core items of the variant. */
  readonly introduced: number
  /** Active core items of the variant (drafts, retired and missing ones never count). */
  readonly total: number
}

const NO_ROADMAP: TrackProgressData = { week: 1, weeks: 0, introduced: 0, total: 0 }

/**
 * The learner's progress on `variant` of `trackId`: week x of N as the plan engine counts it
 * (`roadmapWeek`: active core items only, decision 16 of M4), and the introduced active core items
 * out of all of them. An unknown track or variant (own keys only) has no roadmap.
 */
export function trackProgressOf(
  catalog: PlanCatalog,
  trackId: string,
  variant: string,
  items: Readonly<Record<string, ItemState>>,
): TrackProgressData {
  const track = own(catalog.tracks, trackId)
  const roadmap = track === undefined ? undefined : own(track.roadmaps, variant)
  if (roadmap === undefined) return NO_ROADMAP
  const core = new Set(
    roadmap.weeks
      .flatMap((week) => coreItemsOfWeek(week, catalog))
      .filter((id) => isActiveItem(catalog, id)),
  )
  return {
    week: roadmapWeek(roadmap, catalog, items),
    weeks: roadmap.weeks.length,
    introduced: [...core].filter((id) => own(items, id) !== undefined).length,
    total: core.size,
  }
}
