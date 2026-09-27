import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'
import { serverEnv } from '@/lib/env'

/** SHA-256 of a value: fixed-length input for `timingSafeEqual`, so no length is leaked. */
const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest()

const unauthorized = () =>
  Response.json(
    { ok: false },
    { status: 401, headers: { 'Cache-Control': 'no-store', 'WWW-Authenticate': 'Bearer' } },
  )

/**
 * Guard of the maintenance cron (§2.3, ADR-0034; a name in `GUARD_NAMES`). Vercel cron sends
 * `Authorization: Bearer <CRON_SECRET>`; the header is compared in constant time (both sides
 * hashed, then `timingSafeEqual`). Returns a 401 response to send — no secret configured, a
 * missing or a wrong header — or null to go on. It returns rather than throws, so a route starts
 * with `const denied = await requireCronSecret(request)` and `if (denied) return denied`, which
 * the architecture test (`tools/guards/server-guards.ts`) requires.
 */
export async function requireCronSecret(request: Request): Promise<Response | null> {
  const secret = serverEnv().cronSecret
  const header = request.headers.get('authorization')
  if (!secret || header === null) return unauthorized()
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`)) ? null : unauthorized()
}
