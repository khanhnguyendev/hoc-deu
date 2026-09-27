/**
 * The one public repository (platform design §0): the maintenance cron reads its workflow runs
 * (`lib/ops/github.ts`) and `/admin` links to its runbooks and runs (`features/admin/overview.ts`).
 * A constant, never taken from input. Not server-only: the admin view model is also rendered by
 * the client component catalog.
 */
export const REPOSITORY = 'khanhnguyendev/hoc-deu'
export const REPOSITORY_URL = `https://github.com/${REPOSITORY}`
