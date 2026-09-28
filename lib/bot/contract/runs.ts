/**
 * The `runs` contract of the bot API (§6.4.1, §6.4.6; ADR-0027; task 6.4a): `POST /runs` starts or
 * resumes today's run, `PATCH /runs/{runId}` finishes it. Every request object is strict (an
 * unknown key is `invalid`). The server's routes and M7's `pnpm bot` CLI both import it, so it
 * imports only `zod` (Part B-M6 decision 3).
 */
import { z } from 'zod'

/** `bot_runs.run_key`'s check: a plan run `run_<date>`, a publish run `run_<date>_publish-<n>`. */
export const RUN_KEY_PATTERN = /^run_[0-9]{4}-[0-9]{2}-[0-9]{2}(_publish-[1-9][0-9]{0,2})?$/
/** `bot_run_users.user_ref`'s check: `u_` + 16 lowercase base32 characters (§6.3). */
export const USER_REF_PATTERN = /^u_[a-z2-7]{16}$/
/** `bot_runs.content_pr_url`'s and `content_publish_requests.pr_url`'s check. */
export const PR_URL_PATTERN = /^https:\/\/github\.com\/khanhnguyendev\/hoc-deu\/pull\/[1-9]\d{0,6}$/

/** The API's `runId` is the run key (decision 8); `bot_runs.id` stays server-side. */
export const runKeySchema = z.string().regex(RUN_KEY_PATTERN)
export const userRefSchema = z.string().regex(USER_REF_PATTERN)
export const runModeSchema = z.enum(['live', 'dry_run'])
export type RunMode = z.infer<typeof runModeSchema>

/** `kind` defaults to `plan`; `requestedMode` can only make the run stricter, never live. */
export const runStartRequest = z.strictObject({
  kind: z.enum(['plan', 'publish']).default('plan'),
  requestedMode: runModeSchema.optional(),
})
export type RunStartRequest = z.infer<typeof runStartRequest>

/** A plan run: the pending users (at most the per-run cap) and the eligible users over it. */
export const planRunResponse = z.strictObject({
  runId: runKeySchema,
  mode: runModeSchema,
  catalogVersion: z.string(),
  rulesVersion: z.number().int(),
  contentProposals: z.boolean(),
  users: z.array(userRefSchema),
  deferredUsers: z.number().int().min(0),
})
export type PlanRunResponse = z.infer<typeof planRunResponse>

/** A publish run: the pending publish requests that are in no open PR yet. */
export const publishRunResponse = z.strictObject({
  runId: runKeySchema,
  mode: runModeSchema,
  publishRequests: z.array(z.strictObject({ requestId: z.number().int(), target: z.string() })),
})
export type PublishRunResponse = z.infer<typeof publishRunResponse>

/**
 * The run summary is shown to admins (`admin_bot_runs`, `/admin/bot`): **counts only** — "10
 * users: 7 plans, 4 custom-item sets, 2 overrides; PR #41". It is never a place for learner data,
 * so the server refuses one that carries a user ref, an address (`@`), a URL, markup or a control
 * character (ADR-0027).
 */
export const runSummarySchema = z
  .string()
  .max(500)
  .refine((text) => !/[\p{Cc}<>@]/u.test(text), { message: 'plain text only (no markup or @)' })
  .refine((text) => !/u_[a-z2-7]{16}/.test(text), { message: 'no user refs' })
  .refine((text) => !/https?:\/\/|www\./i.test(text), { message: 'no URLs' })

export const runFinishRequest = z.strictObject({
  status: z.enum(['completed', 'failed']),
  summary: runSummarySchema.optional(),
  contentPrUrl: z.string().regex(PR_URL_PATTERN).optional(),
  publishRequestIds: z.array(z.number().int().positive()).max(100).optional(),
})
export type RunFinishRequest = z.infer<typeof runFinishRequest>

/**
 * `PATCH /runs/{runId}` → 200. `details` lists the `publishRequestIds` that were ignored — not
 * pending, not a publish run, or no `contentPrUrl` to set.
 */
export const runFinishResponse = z.strictObject({
  ok: z.literal(true),
  details: z.array(z.strictObject({ requestId: z.number().int(), reason: z.string() })).optional(),
})
export type RunFinishResponse = z.infer<typeof runFinishResponse>

/** Every error answer of the bot API (§6.4): a code, and details for `invalid`. */
export const botErrorBody = z.strictObject({
  error: z.string(),
  details: z.array(z.unknown()).optional(),
})
export type BotErrorBody = z.infer<typeof botErrorBody>
