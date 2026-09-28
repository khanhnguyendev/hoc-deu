import { requireBotToken } from '@/lib/auth/bot'
import { writeOverrides } from '@/lib/bot/overrides'
import { botError, internalError, readBody } from '@/lib/bot/route'
import { resolveRunUser } from '@/lib/bot/runs'
import { idempotentWrite } from '@/lib/bot/writes'

/**
 * `PUT /api/bot/v1/runs/{runId}/users/{userRef}/overrides` — roadmap overrides (§6.4.5, §5.12;
 * Part B-M6 decisions 6, 10–12, 18, 33; task 6.6c). `requireBotToken` first; the user only
 * through `resolveRunUser` (an unknown run or ref, or a run that is not running: `404
 * {"error":"not_found"}`); the body read once (at most 64 KB); then `idempotentWrite` (kind
 * `overrides`: the `Idempotency-Key`, the replay of a stored answer, the record) around
 * `writeOverrides`, which checks the AI flag (`409 {"error":"ai_off"}`), validates the body with
 * `overridesRequest` and every entry — all or nothing, `invalid` counted and never binding the
 * key — and then writes, or in a dry run records the proposal. JSON only, never cached.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ runId: string; userRef: string }> },
): Promise<Response> {
  const denied = await requireBotToken(request)
  if (denied) return denied
  const { runId, userRef } = await params
  try {
    const runUser = await resolveRunUser(runId, userRef)
    if (runUser === null) return botError(404, 'not_found')
    const body = await readBody(request)
    if (!body.ok) return body.response
    const now = new Date()
    return await idempotentWrite(runUser, 'overrides', request, body.data, () =>
      writeOverrides(runUser, body.data, now),
    )
  } catch (error) {
    return internalError('PUT /runs/{runId}/users/{userRef}/overrides', error)
  }
}
