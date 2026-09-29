import { requireBotToken } from '@/lib/auth/bot'
import { buildContext } from '@/lib/bot/context'
import { botError, botJson, internalError } from '@/lib/bot/route'
import { resolveRunUser } from '@/lib/bot/runs'

/**
 * `GET /api/bot/v1/runs/{runId}/users/{userRef}/context` — one learner's day for the bot (§6.4.2,
 * §6.3; Part B-M6 decisions 6, 9, 32; task 6.4b): pseudonymised and allow-listed
 * (`lib/bot/contract/context.ts`). `requireBotToken` first; the user only through
 * `resolveRunUser` — an unknown run or ref, or a run that is not running (finished, failed), is
 * `404 {"error":"not_found"}`; then `buildContext`. JSON only, never cached; a failure is `500
 * {"error":"internal"}`, logged by code only.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string; userRef: string }> },
): Promise<Response> {
  const denied = await requireBotToken(request)
  if (denied) return denied
  const { runId, userRef } = await params
  try {
    const runUser = await resolveRunUser(runId, userRef, new Date())
    if (runUser === null) return botError(404, 'not_found')
    return botJson(200, await buildContext(runUser, new Date()))
  } catch (error) {
    return internalError('GET /runs/{runId}/users/{userRef}/context', error)
  }
}
