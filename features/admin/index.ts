/**
 * `features/admin` (§2.4 `/admin`, `/admin/users`, `/admin/content`, `/admin/bot`). **Server-only:** it
 * re-exports the loaders. The components take plain props, so the component catalog imports their
 * files directly.
 */
export {
  cancelPublish,
  requestPublish,
  rotateBotToken,
  setAiFlag,
  setUserRole,
  setUserStatus,
  updateBotSettings,
  type AdminActionResult,
  type BotSettingsInput,
} from './actions'
export type { AdminBotPage, BotControlsView, BotRunLogView, BotRunRow, BotTokenView } from './bot'
export { AdminOverview } from './components/admin-overview'
export { BotControls } from './components/bot-controls'
export { BotRunLog } from './components/bot-run-log'
export { BotToken } from './components/bot-token'
export { CatalogStats } from './components/catalog-stats'
export { ContentCoverage } from './components/content-coverage'
export { DraftsList } from './components/drafts-list'
export { PublishButton } from './components/publish-button'
export { PublishRequests } from './components/publish-requests'
export { UserQueue } from './components/user-queue'
export type { ContentPage, PublishRequestsView, TrackContent } from './content'
export type { AdminOverviewPage } from './overview'
export {
  getAdminBot,
  getAdminContent,
  getAdminOverview,
  listUsers,
  type AdminUserRow,
} from './queries'
