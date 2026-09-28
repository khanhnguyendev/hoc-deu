import { requireBotToken } from '@/lib/auth/bot'
import { writePlan } from '@/lib/bot/plan'
import { botError, internalError, readBody } from '@/lib/bot/route'
import { resolveRunUser } from '@/lib/bot/runs'
import { idempotentWrite } from '@/lib/bot/writes'

/**
 * `PUT /api/bot/v1/runs/{runId}/users/{userRef}/plan` — today's plan for one learner (§6.4.3, §2.3;
 * Part B-M6 decisions 6, 9–15; ADR-0018; task 6.5b). `requireBotToken` first; the user only through
 * `resolveRunUser` (an unknown run or ref, or a run that is not running: `404
 * {"error":"not_found"}`); the body read once (at most 64 KB); then `idempotentWrite` (kind
 * `plan`: the `Idempotency-Key`, the replay of a stored answer, the record) around `writePlan`,
 * which validates the body with the strict `planRequest` and the learner's allowance — `invalid`
 * counted and never binding the key — re-checks the gate and unseen AI plans, and then stores the
 * plan through `plan.ai_proposed`, or in a dry run records the proposal. JSON only, never cached.
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
    return await idempotentWrite(runUser, 'plan', request, body.data, () =>
      writePlan(runUser, body.data, now),
    )
  } catch (error) {
    return internalError('PUT /runs/{runId}/users/{userRef}/plan', error)
  }
}
