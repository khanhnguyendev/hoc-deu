/**
 * The `custom-items` contract of the bot API (§6.4.4; Part B-M6 decisions 3, 17, 33; task 6.6a):
 * `PUT /runs/{runId}/users/{userRef}/custom-items` creates per-user items — `user:<bot_ref>:<slug>`,
 * the ID is the server's — and retires the user's own. Every request object is strict (an unknown
 * key is `invalid`); the payload is validated on the server with the repository's item schemas
 * (`lib/content/user-items.ts`), so here it is only an object. Imports only `zod` (decision 3).
 */
import { z } from 'zod'

/** A custom item's slug: unique per user, the last part of its ID. */
export const CUSTOM_ITEM_SLUG_PATTERN = /^[a-z0-9-]{3,48}$/
/** `user_items.item_id`'s check: `user:` + the profile's 16-hex `bot_ref` + `:` + the slug. */
export const CUSTOM_ITEM_ID_PATTERN = /^user:[0-9a-f]{16}:[a-z0-9-]{3,48}$/

/** The item types a custom item may have (§5.12); the track's `itemTypes` narrow them further. */
export const CUSTOM_ITEM_TYPES = ['flashcard', 'exercise', 'prompt'] as const
export type CustomItemType = (typeof CUSTOM_ITEM_TYPES)[number]

export const customItemSlug = z.string().regex(CUSTOM_ITEM_SLUG_PATTERN)

export const customItemInput = z.strictObject({
  slug: customItemSlug,
  type: z.enum(CUSTOM_ITEM_TYPES),
  trackId: z.string(),
  topicId: z.string(),
  payload: z.record(z.string(), z.unknown()),
})
export type CustomItemInput = z.infer<typeof customItemInput>

/** At most 10 new items and 50 retirements per request; at least one of either. */
export const customItemsRequest = z
  .strictObject({
    items: z.array(customItemInput).max(10),
    retire: z.array(z.string().regex(CUSTOM_ITEM_ID_PATTERN)).max(50).default([]),
  })
  .refine((body) => body.items.length + body.retire.length > 0, {
    message: 'items or retire must list something',
  })
export type CustomItemsRequest = z.infer<typeof customItemsRequest>

/**
 * `applied` (live), `dry_run` (validated, nothing written) or `invalid` (nothing written, the
 * reasons in `details`). `created` lists every item's ID — also one that already existed with the
 * same slug and payload (a no-op, §6.4.4) — and `retired` every retired ID.
 */
export const customItemsResponse = z.strictObject({
  outcome: z.enum(['applied', 'dry_run', 'invalid']),
  created: z.array(z.string()),
  retired: z.array(z.string()),
  details: z.array(z.unknown()).optional(),
})
export type CustomItemsResponse = z.infer<typeof customItemsResponse>
