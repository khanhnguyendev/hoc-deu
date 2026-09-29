import 'server-only'
import { readBotSettings } from '@/lib/bot/settings'
import { tokenHash, tokenMatches } from '@/lib/bot/token'
import { serverEnv } from '@/lib/env'
import { checkLimit } from '@/lib/rate-limit'

/** Every bot response is JSON and never cached (§6.4, Part B-M6 subagent contract). */
function botError(status: number, error: string, headers: Record<string, string> = {}): Response {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
}

const BEARER = /^Bearer (\S+)$/

/**
 * Guard of the bot API (`/api/bot/v1/*`; §2.2, §6.2–§6.4, ADR-0026; Part B-M6 decision 7), a
 * response guard like `requireCronSecret` (`RESPONSE_GUARD_NAMES`): a route starts with
 * `const denied = await requireBotToken(request)` and `if (denied) return denied`. In this order:
 *
 * 1. `BOT_API_ENABLED` is not `true` → `503 {"error":"disabled"}`, before the database is read.
 * 2. `bot_settings.enabled` is false → the same 503 (the two locks: both must be on).
 * 3. No `Authorization: Bearer <token>`, or a token whose SHA-256 matches neither the current hash
 *    nor the previous one while it is valid → `401 {"error":"unauthorized"}` (constant time).
 * 4. Over 120 requests / 10 min for the token → `429 {"error":"rate_limited"}` with `Retry-After`
 *    (identifier: the first 16 hex characters of the token's hash, never the token).
 *
 * Otherwise null: go on. A settings read that fails answers `500 {"error":"internal"}`. Every
 * answer carries `Cache-Control: no-store`; none echoes the header.
 */
export async function requireBotToken(request: Request): Promise<Response | null> {
  if (!serverEnv().botApiEnabled) return botError(503, 'disabled')

  let state: Awaited<ReturnType<typeof readBotSettings>>
  try {
    state = await readBotSettings()
  } catch {
    return botError(500, 'internal')
  }
  if (!state.settings.enabled) return botError(503, 'disabled')

  const presented = BEARER.exec(request.headers.get('authorization') ?? '')?.[1]
  if (presented === undefined || !tokenMatches(presented, state.token, new Date())) {
    return botError(401, 'unauthorized', { 'WWW-Authenticate': 'Bearer' })
  }

  const limit = await checkLimit('botApi', tokenHash(presented).slice(0, 16))
  if (!limit.ok) {
    return botError(429, 'rate_limited', {
      'Retry-After': String(Math.max(1, limit.retryAfterSeconds)),
    })
  }
  return null
}
