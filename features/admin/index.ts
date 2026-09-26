/**
 * `features/admin` (§2.4 `/admin`, `/admin/users`, `/admin/content`). **Server-only:** it
 * re-exports the loaders. The components take plain props, so the component catalog imports their
 * files directly.
 */
export { setUserRole, setUserStatus, type AdminActionResult } from './actions'
export { AdminOverview } from './components/admin-overview'
export { CatalogStats } from './components/catalog-stats'
export { ContentCoverage } from './components/content-coverage'
export { DraftsList } from './components/drafts-list'
export { UserQueue } from './components/user-queue'
export type { ContentPage, TrackContent } from './content'
export type { AdminOverviewPage } from './overview'
export { getAdminContent, getAdminOverview, listUsers, type AdminUserRow } from './queries'
