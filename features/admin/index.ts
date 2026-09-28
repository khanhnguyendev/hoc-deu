/**
 * `features/admin` (§2.4 `/admin`, `/admin/users`, `/admin/content`, `/admin/bot`). **Server-only:** it
 * re-exports the loaders. The components take plain props, so the component catalog imports their
 * files directly.
 */
export {
  rotateBotToken,
  setAiFlag,
  setUserRole,
  setUserStatus,
  updateBotSettings,
  type AdminActionResult,
  type BotSettingsInput,
} from './actions'
export type { AdminBotPage, BotControlsView, BotTokenView } from './bot'
export { AdminOverview } from './components/admin-overview'
export { BotControls } from './components/bot-controls'
export { BotToken } from './components/bot-token'
export { CatalogStats } from './components/catalog-stats'
export { ContentCoverage } from './components/content-coverage'
export { DraftsList } from './components/drafts-list'
export { UserQueue } from './components/user-queue'
export type { ContentPage, TrackContent } from './content'
export type { AdminOverviewPage } from './overview'
export {
  getAdminBot,
  getAdminContent,
  getAdminOverview,
  listUsers,
  type AdminUserRow,
} from './queries'
