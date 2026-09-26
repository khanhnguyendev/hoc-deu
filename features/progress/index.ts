/**
 * `/progress` (platform design §2.4; task 5.5). **Server-only:** it re-exports the loader. The
 * component takes plain props (`ProgressPage`), so the component catalog imports its file directly.
 */
export { ProgressView } from './components/progress-view'
export { getProgress } from './queries'
export type { ProgressPage } from './view-model'
