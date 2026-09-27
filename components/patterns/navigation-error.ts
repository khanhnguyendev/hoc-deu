/**
 * Whether an error a server action's promise rejected with is Next's own navigation — a
 * `redirect()` (a guard sending an expired session to `/sign-in`, a signed-out account away) or a
 * `notFound()` / `forbidden()` — rather than a failure. The router has already started that
 * navigation by the time the rejection arrives (`server-action-reducer.js`), so a control says
 * nothing about it (M1): no "save failed", no toast on the next page. Recognised by the error's
 * `digest` (Next's `NEXT_REDIRECT` and `NEXT_HTTP_ERROR_FALLBACK` codes), never by rethrowing — a
 * rethrow from an event handler has no boundary to catch it. A plain module: client code only.
 */
export function isNavigationError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('digest' in error)) return false
  const { digest } = error as { digest: unknown }
  return (
    typeof digest === 'string' &&
    (digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_HTTP_ERROR_FALLBACK'))
  )
}
