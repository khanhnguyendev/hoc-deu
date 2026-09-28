import { requireBotToken } from '@/lib/auth/bot'
import { botError, botJson, internalError } from '@/lib/bot/route'
import { contentSignals, signalsAccess } from '@/lib/bot/signals'

/**
 * `GET /api/bot/v1/runs/{runId}/content-signals` — the input of the shared content loop (§6.4.7,
 * Part B-M6 decision 19): aggregates only, no learner text and no per-user rows.
 * `requireBotToken` first; the run must be today's plan run (`404 {"error":"not_found"}`) and
 * `bot_settings.content_proposals` on (`409 {"error":"content_proposals_off"}`). Never cached.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const denied = await requireBotToken(request)
  if (denied) return denied
  const { runId } = await params
  const now = new Date()
  try {
    const access = await signalsAccess(runId, now)
    if (access === 'not_found') return botError(404, 'not_found')
    if (access === 'content_proposals_off') return botError(409, 'content_proposals_off')
    return botJson(200, await contentSignals(now))
  } catch (error) {
    return internalError('GET /runs/{runId}/content-signals', error)
  }
}
