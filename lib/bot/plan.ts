/**
 * `PUT /runs/{runId}/users/{userRef}/plan` (platform design §2.3, §5.2, §6.4.3; Part B-M6
 * decisions 9–15, 36; ADR-0018; task 6.5b): the write `idempotentWrite` runs for kind `plan`, so an
 * `invalid` answer is counted and never binds the key.
 *
 * In order: the body (`planRequest`, strict); the stored event of this write — its id is
 * `deriveEventId(<run uuid>, '<ref>:plan')` — when a first attempt landed but its answer was never
 * recorded (a crash, a timeout): answered from it (`plan.ai_applied` → `applied` with its version,
 * `plan.ai_skipped` → `skipped_plan_in_use`); the learner's day (`loadUserDay`, 6.4b) and decision
 * 9's rules again, since the state may have changed since the run started — `paused` / `resumed` →
 * `skipped_gate_closed`, the latest plan an unseen AI plan → `skipped_unseen`; then
 * `validateAiPlan` (6.5a) against `allowanceOf` (6.4b) → `invalid` with the issues; a dry run
 * stores the proposal (`detail.plan`) and writes nothing else (decision 11); a live run stores the
 * plan through `storeAiPlan` with the baseline build's snapshots (decision 15), and the database
 * applies the §2.3 precedence under the plan lock. Server-only; nothing a learner wrote is logged.
 */
import 'server-only'
import { validateAiPlan, type AiPlanIssue } from '@/lib/domain/plan/ai'
import type { LocalDay } from '@/lib/domain/time/localDay'
import { EventError } from '@/lib/events/apply'
import { deriveEventId } from '@/lib/events/ids'
import { AI_RATIONALE_MAX_CHARS, storeAiPlan } from '@/lib/events/plans'
import { createAdminClient } from '@/lib/supabase/admin'
import { activeCustomItemIds, allowanceOf, loadUserDay, type UserDay } from './context'
import { planRequest, type PlanRequest, type PlanResponse } from './contract/plan'
import { boundedProposal, recordProposal } from './proposals'
import { issueDetails } from './route'
import type { RunUser } from './runs'
import { readBotSettings } from './settings'
import type { WriteOutcome } from './writes'

export const KIND = 'plan'

type Admin = ReturnType<typeof createAdminClient>

/** Every answer has an outcome: `idempotentWrite` records it (an `invalid` one is only counted). */
export type PlanAnswer = { status: number; body: PlanResponse; outcome: WriteOutcome }

const answer = (outcome: Exclude<WriteOutcome, 'invalid'>, planVersion?: number): PlanAnswer => ({
  status: 200,
  body: planVersion === undefined ? { outcome } : { outcome, planVersion },
  outcome,
})

const invalid = (details: readonly unknown[]): PlanAnswer => ({
  status: 422,
  body: { outcome: 'invalid', details: [...details] },
  outcome: 'invalid',
})

/** The stored `plan.ai_*` event of this write, as its answer; null when there is none. */
async function storedAnswer(
  admin: Admin,
  userId: string,
  eventId: string,
): Promise<PlanAnswer | null> {
  const { data, error } = await admin
    .from('events')
    .select('type, payload')
    .eq('id', eventId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error('Could not read the stored plan event', { cause: error })
  if (data === null) return null
  const payload =
    data.payload !== null && typeof data.payload === 'object' && !Array.isArray(data.payload)
      ? data.payload
      : {}
  if (data.type === 'plan.ai_skipped') return answer('skipped_plan_in_use')
  if (data.type === 'plan.ai_applied' && typeof payload.planVersion === 'number') {
    return answer('applied', payload.planVersion)
  }
  throw new Error('The event id of a plan write names another event')
}

/** The latest plan dated on or before `today` is an AI plan the learner has not seen (§5.2). */
async function latestPlanIsUnseenAi(
  admin: Admin,
  userId: string,
  today: LocalDay,
): Promise<boolean> {
  const { data, error } = await admin
    .from('day_plans')
    .select('source, seen_at')
    .eq('user_id', userId)
    .lte('plan_date', today)
    .order('plan_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error('Could not read the latest plan', { cause: error })
  return data !== null && data.source === 'ai' && data.seen_at === null
}

/** Decision 9 at the write: the gate, then an unseen AI plan; null when the plan may be written. */
async function skipped(admin: Admin, userId: string, u: UserDay): Promise<PlanAnswer | null> {
  const { resolution } = u
  if (resolution.kind === 'paused' || resolution.kind === 'resumed') {
    return answer('skipped_gate_closed')
  }
  const unseen =
    resolution.kind === 'today'
      ? resolution.read.row.source === 'ai' && resolution.read.row.seen_at === null
      : await latestPlanIsUnseenAi(admin, userId, u.day.today)
  return unseen ? answer('skipped_unseen') : null
}

/**
 * A database refusal as an answer, or null to rethrow: `day_changed` (the request crossed the
 * learner's day start — retry, the context has the new day), `ai_off` (the flag turned off
 * mid-run), `invalid_event` while `bot_settings.dry_run` is now on (an admin turned dry-run on
 * mid-write, decision 8 — the retry runs as a dry run).
 */
async function refused(error: unknown): Promise<PlanAnswer | null> {
  if (!(error instanceof EventError)) return null
  if (error.code === 'day_changed') return invalid([{ code: 'day_changed', retryable: true }])
  if (error.code === 'ai_off') return invalid([{ code: 'ai_off' }])
  if (error.code === 'invalid_event' && (await readBotSettings()).settings.dryRun) {
    return invalid([{ code: 'dry_run_started', retryable: true }])
  }
  return null
}

/** `PUT …/plan` for a parsed body (see the file comment). */
export async function putPlan(runUser: RunUser, body: PlanRequest, now: Date): Promise<PlanAnswer> {
  const admin = createAdminClient()
  const eventId = deriveEventId(runUser.runUuid, `${runUser.userRef}:${KIND}`)
  const landed = await storedAnswer(admin, runUser.userId, eventId)
  if (landed !== null) return landed

  const u = await loadUserDay(runUser.userId, now)
  const skip = await skipped(admin, runUser.userId, u)
  if (skip !== null) return skip

  const result = validateAiPlan(body, allowanceOf(u, activeCustomItemIds(u)))
  if (!result.ok) return invalid(result.issues)
  // The database counts characters (code points), the validation graphemes: an emoji-heavy
  // rationale can pass one and not the other.
  if ([...result.rationale].length > AI_RATIONALE_MAX_CHARS) {
    const issue: AiPlanIssue = { path: 'rationale', code: 'rationale' }
    return invalid([issue])
  }

  if (runUser.mode === 'dry_run') {
    const proposal = {
      targetDate: body.targetDate,
      blocks: body.blocks,
      rationale: result.rationale,
    }
    await recordProposal(
      admin,
      runUser,
      KIND,
      boundedProposal(proposal, () => ({
        ...proposal,
        blocks: body.blocks.map(({ itemIds, ...block }) => ({ ...block, items: itemIds.length })),
        itemIdsOmitted: true,
      })),
    )
    return answer('dry_run')
  }

  let stored: Awaited<ReturnType<typeof storeAiPlan>>
  try {
    stored = await storeAiPlan(admin, runUser.userId, {
      eventId,
      runKey: runUser.runKey,
      runUuid: runUser.runUuid,
      plan: { planDate: u.day.today, blocks: result.blocks, tracks: u.baseline.tracks },
      rationale: result.rationale,
      localDay: u.day.today,
    })
  } catch (error) {
    const refusal = await refused(error)
    if (refusal === null) throw error
    return refusal
  }
  switch (stored.outcome) {
    case 'applied':
      return answer('applied', stored.version ?? undefined)
    case 'plan_in_use':
      return answer('skipped_plan_in_use')
    case 'duplicate': {
      const again = await storedAnswer(admin, runUser.userId, eventId)
      if (again === null) throw new Error('A duplicate plan write left no event')
      return again
    }
  }
}

/** The write `idempotentWrite` runs (the route's): the body by the strict contract, then put. */
export async function writePlan(runUser: RunUser, body: unknown, now: Date): Promise<PlanAnswer> {
  const parsed = planRequest.safeParse(body)
  if (!parsed.success) return invalid(issueDetails(parsed.error))
  return putPlan(runUser, parsed.data, now)
}
