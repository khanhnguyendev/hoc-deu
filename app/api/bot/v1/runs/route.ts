import { requireBotToken } from '@/lib/auth/bot'
import { runStartRequest } from '@/lib/bot/contract/runs'
import { botJson, internalError, readJson } from '@/lib/bot/route'
import { startRun } from '@/lib/bot/runs'

/**
 * `POST /api/bot/v1/runs` — start or resume today's run (§6.4.1, ADR-0027). The bot token first
 * (kill switch, token, rate limit — `requireBotToken`), then the body (`runStartRequest`, at most
 * 64 KB; an empty body is `{}`), then `startRun`: a plan run's pending users (at most the per-run cap) and deferred
 * count, or a publish run's pending requests. JSON only, never cached.
 */
export async function POST(request: Request): Promise<Response> {
  const denied = await requireBotToken(request)
  if (denied) return denied
  const input = await readJson(request, runStartRequest, { empty: {} })
  if (!input.ok) return input.response
  try {
    return botJson(200, await startRun(input.data, new Date()))
  } catch (error) {
    return internalError('POST /runs', error)
  }
}
