/**
 * The `plan` contract of the bot API (§6.4.3; Part B-M6 decisions 3, 9, 10, 13, 15; task 6.5b):
 * `PUT /runs/{runId}/users/{userRef}/plan` proposes today's plan for one learner. The body is
 * strict (an unknown key is `invalid`); the server checks it against the learner's allowance
 * (`validateAiPlan`, `lib/domain/plan/ai.ts`) and recomputes every minute from the catalog. The
 * rationale is cleaned on the server (markup, URLs and control characters stripped) and must then
 * hold at most 280 graphemes; the 2000 here only bounds the raw text. Imports only `zod` and
 * `lib/domain` (decision 3).
 */
import { z } from 'zod'
import { ITEM_MODES } from '@/lib/domain/catalog'
import { isLocalDay } from '@/lib/domain/time/localDay'

/** A learner's local day, `YYYY-MM-DD` (§5.1). */
export const localDaySchema = z.string().refine(isLocalDay, 'a local day YYYY-MM-DD')

/** The block kinds an AI plan may hold (the server numbers them, §5.4 step 8). */
export const AI_PLAN_BLOCK_KINDS = ['review', 'new', 'practice', 'recap'] as const

export const planBlockRequest = z.strictObject({
  trackId: z.string(),
  kind: z.enum(AI_PLAN_BLOCK_KINDS),
  itemIds: z.array(z.string()).min(1).max(50),
  mode: z.enum(ITEM_MODES).optional(),
})

export const planRequest = z.strictObject({
  targetDate: localDaySchema,
  blocks: z.array(planBlockRequest).min(1).max(20),
  /** Plain text after cleaning, at most 280 graphemes (§6.4.3 rule 6). */
  rationale: z.string().max(2000),
})
export type PlanRequest = z.infer<typeof planRequest>

/** Every answer's outcome (§6.4.3). */
export const PLAN_OUTCOMES = [
  'applied',
  'dry_run',
  'skipped_plan_in_use',
  'skipped_gate_closed',
  'skipped_unseen',
  'invalid',
] as const
export type PlanOutcome = (typeof PLAN_OUTCOMES)[number]

export const planResponse = z.strictObject({
  outcome: z.enum(PLAN_OUTCOMES),
  /** `applied`: the stored plan's version. */
  planVersion: z.number().int().optional(),
  /** `invalid`: what failed (a path and a code each; `retryable: true` for `day_changed`). */
  details: z.array(z.unknown()).optional(),
})
export type PlanResponse = z.infer<typeof planResponse>
