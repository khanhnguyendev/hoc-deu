import { requireBotToken } from '@/lib/auth/bot'
import { runFinishRequest } from '@/lib/bot/contract/runs'
import { botError, botJson, internalError, readJson } from '@/lib/bot/route'
import { finishRun } from '@/lib/bot/runs'

/**
 * `PATCH /api/bot/v1/runs/{runId}` — finish a run (§6.4.6, ADR-0027): the status, the summary
 * (counts only), the content PR URL and, for a publish run, `pr_url` on the listed pending
 * requests. `requireBotToken` first, then the body (`runFinishRequest`). An unknown run is `404
 * {"error":"not_found"}`, a run that is no longer running (completed, failed, timed out) `409
 * {"error":"not_running"}`; the ignored request ids come back in `details`. Never cached.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const denied = await requireBotToken(request)
  if (denied) return denied
  const { runId } = await params
  try {
    // Inside the try: an aborted body is the JSON 500, never cached.
    const input = await readJson(request, runFinishRequest)
    if (!input.ok) return input.response
    const result = await finishRun(runId, input.data, new Date())
    if (result.outcome === 'not_found') return botError(404, 'not_found')
    if (result.outcome === 'not_running') return botError(409, 'not_running')
    return botJson(
      200,
      result.ignored.length === 0 ? { ok: true } : { ok: true, details: result.ignored },
    )
  } catch (error) {
    return internalError('PATCH /runs/{runId}', error)
  }
}
