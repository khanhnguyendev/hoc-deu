/**
 * The `overrides` contract of the bot API (§6.4.5; §5.12; Part B-M6 decisions 3, 18, 33; task
 * 6.6c): `PUT /runs/{runId}/users/{userRef}/overrides` sets and revokes roadmap overrides, each
 * idempotent by `(trackId, key)`. Every request object is strict (an unknown key is `invalid`);
 * `params` is only an object here — the server parses it with the kind's schema
 * (`overrideParamsSchemas`) and checks the bounds that need the catalog (`validateOverride`); the
 * counts are the database's (decision 33). Imports only `zod` and `lib/domain` (decision 3).
 */
import { z } from 'zod'

/** `roadmap_overrides.key`'s check. */
export const OVERRIDE_KEY_PATTERN = /^[a-z0-9-]{3,48}$/

export const OVERRIDE_KINDS = ['insert_block', 'extra_week', 'reorder_topics'] as const

export const overrideSet = z.strictObject({
  key: z.string().regex(OVERRIDE_KEY_PATTERN),
  kind: z.enum(OVERRIDE_KINDS),
  trackId: z.string(),
  params: z.record(z.string(), z.unknown()),
})
export type OverrideSet = z.infer<typeof overrideSet>

export const overrideRevoke = z.strictObject({ trackId: z.string(), key: z.string() })

/** At most 6 overrides set and 10 revoked per request; at least one of either. */
export const overridesRequest = z
  .strictObject({
    set: z.array(overrideSet).max(6).default([]),
    revoke: z.array(overrideRevoke).max(10).default([]),
  })
  .refine((body) => body.set.length + body.revoke.length > 0, {
    message: 'set or revoke must list something',
  })
export type OverridesRequest = z.infer<typeof overridesRequest>

/**
 * `applied` (live), `dry_run` (validated, nothing written) or `invalid` (nothing written — or,
 * when the database refused a later entry, what was written is in the detail — the reasons in
 * `details`). `active` = the user's overrides in force after the call (decision 18's computed
 * expiry), by track and key.
 */
export const overridesResponse = z.strictObject({
  outcome: z.enum(['applied', 'dry_run', 'invalid']),
  active: z.array(z.strictObject({ trackId: z.string(), key: z.string() })),
  details: z.array(z.unknown()).optional(),
})
export type OverridesResponse = z.infer<typeof overridesResponse>
