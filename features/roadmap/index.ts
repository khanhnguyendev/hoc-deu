/**
 * `/tracks`, `/t/[trackId]` and the item route (task 3.4b; decision 23; the learner's progress,
 * Weak items and "Bắt đầu lại" on the track page, task 5.4). **Server-only:** it
 * re-exports the loaders. The components take plain props and ReactNode slots and never import the
 * item registry (fix 5), so the component catalog imports their files directly. `ItemBody` (task
 * 5.1c, ruling M5-R6) is not a catalog component at all — a render helper next to `queries.ts`,
 * like `renderItemPage` next to `features/items`' own loaders — that loads the item's MDX and code
 * through the item registry and renders only inside `ItemView`'s `<Suspense>` boundary.
 */
export { ItemBody } from './item-body'
export { ItemView } from './components/item-view'
export { ResetTrackButton, type ResetTrackAction } from './components/reset-track-button'
export { RoadmapView } from './components/roadmap-view'
export { TrackList } from './components/track-list'
export { TrackOverview } from './components/track-overview'
export { TrackProgress } from './components/track-progress'
export { WeakItems } from './components/weak-items'
export {
  getItemPage,
  getTrackPage,
  getTracksOverview,
  type Enrollment,
  type ItemPageModel,
  type TrackPageData,
  type TracksOverview,
  type TrackSummary,
  type VariantLink,
} from './queries'
export { roadmapSlots, type RoadmapSlots, type RowRenderer, type WeekSlots } from './slots'
export type { RoadmapView as RoadmapViewModel, TrackProgressData, WeekView } from './view-model'
