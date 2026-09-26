/**
 * Guard vocabulary (platform design §2.2). Every server action, route handler and
 * `features/*\/queries.ts` loader starts with a call to one of these names; the architecture test
 * (`tools/guards/server-guards.ts`) enforces it. The DAL guards live in `lib/auth/dal.ts` and
 * throw (`redirect()` / `notFound()`); `requireCronSecret` (maintenance cron, task 5.7a) lives in
 * `lib/auth/cron.ts` and **returns** its denial instead of throwing (`RESPONSE_GUARD_NAMES`);
 * `requireBotToken` (bot API, v1.1) arrives with its routes.
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

/**
 * Guards that return synchronously and may be called without `await`. Every other guard is async:
 * an un-awaited call lets the handler run on while its `redirect()` becomes an unhandled rejection,
 * so the architecture test requires `await` for it (fix round 1 ruling). A future synchronous
 * guard (e.g. a header check) is added here explicitly.
 */
export const SYNC_GUARD_NAMES: readonly string[] = ['publicRoute']

/**
 * Guards that answer a denial instead of throwing: they return a `Response` to send, or null to go
 * on (`requireCronSecret`, `lib/auth/cron.ts`). Calling one proves nothing unless the denial is
 * returned at once, so the architecture test accepts them only as
 * `const denied = await requireX(request)` directly followed by `if (denied) return denied`
 * (task 5.7a). Any guard that returns a `Response` — e.g. a future `requireBotToken` — must be
 * listed here, or a handler that drops its denial would pass the test.
 */
export const RESPONSE_GUARD_NAMES: readonly string[] = ['requireCronSecret']
