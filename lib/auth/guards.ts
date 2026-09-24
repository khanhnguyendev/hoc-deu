/**
 * Guard vocabulary (platform design §2.2). Every server action, route handler and
 * `features/*\/queries.ts` loader starts with a call to one of these names; the architecture test
 * (`tools/guards/server-guards.ts`) enforces it. The DAL guards live in `lib/auth/dal.ts`;
 * `requireBotToken` (bot API) and `requireCronSecret` (maintenance cron) arrive with their routes.
 */

/**
 * Explicit marker for handlers that are public on purpose (§2.2): health, publish requests and
 * the OAuth callback. It does nothing at runtime; it makes "no access check" a visible decision
 * that a reviewer can see and grep for.
 */
export function publicRoute(): void {}

export const GUARD_NAMES: readonly string[] = [
  'requireUser',
  'requireActive',
  'requireOnboarded',
  'requireAdmin',
  'requireDevAccess',
  'requireBotToken',
  'requireCronSecret',
  'publicRoute',
]
