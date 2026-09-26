/**
 * `/today`'s public API (task 5.1b). **Not for client components:** `getToday` and `todaySlots`
 * are server-only (the plan service, the item registry). Client code imports the component files
 * directly and only `import type`s from here.
 */
export { markPlanSeen, resumeTodayAction, type ResumeResult } from './actions'
export { TodayView, type TodayViewProps } from './components/today-view'
export { getToday } from './queries'
export { todaySlots } from './rows'
export type { BlockItemSlot, BlockSlots, ShadowingSentence, TodaySlots } from './slots'
export {
  buildTodayPage,
  type BlockView,
  type TodayPage,
  type TrackProgressView,
  type WeakTopicView,
} from './view-model'
