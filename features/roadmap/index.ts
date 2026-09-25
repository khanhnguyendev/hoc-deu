/**
 * `/tracks`, `/t/[trackId]` and the item route (task 3.4b; decision 23). **Server-only:** it
 * re-exports the loaders. The components take plain props and ReactNode slots and never import the
 * item registry (fix 5), so the component catalog imports their files directly.
 */
export { ItemView } from './components/item-view'
export { RoadmapView } from './components/roadmap-view'
export { TrackList } from './components/track-list'
export { TrackOverview } from './components/track-overview'
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
export type { RoadmapView as RoadmapViewModel, WeekView } from './view-model'
