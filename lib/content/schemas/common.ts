/**
 * Building blocks shared by the content schemas (platform design §3.2–§3.5): the item types and
 * statuses, the code languages, localized text, links and bot provenance.
 */
import { z } from 'zod'

// The code-language list lives in `lib/domain` (the event payloads use it, and `lib/domain` imports
// nothing outside itself); content and the app read it from here.
export { CODE_LANGUAGES, type CodeLanguage } from '@/lib/domain/settings'

export const ITEM_TYPES = ['problem', 'flashcard', 'lesson', 'exercise', 'prompt'] as const
export type ItemType = (typeof ITEM_TYPES)[number]

/** `draft` = admins only; `active` = available; `retired` = kept for history, never scheduled. */
export const ITEM_STATUSES = ['draft', 'active', 'retired'] as const
export type ItemStatus = (typeof ITEM_STATUSES)[number]

/** Text with something in it; surrounding whitespace is dropped. */
export const nonEmptyText = z.string().trim().min(1)

/** A title or instruction in both languages. */
export const localizedTextSchema = z.strictObject({ vi: nonEmptyText, en: nonEmptyText })
export type LocalizedText = z.infer<typeof localizedTextSchema>

/** Links in content are `https:` only (§3.6 MDX safety applies the same rule to MDX). */
export const httpsUrlSchema = z.url({ protocol: /^https$/, error: 'must be an https: URL' })

/** An item's status (§3.3); omitted means `active`. */
export const itemStatusSchema = z.enum(ITEM_STATUSES).default('active')

/** Provenance of bot-written items (§3.3, decision 26): `origin: bot`, `createdByRun: run_<date>`. */
export const provenanceShape = {
  origin: z.literal('bot').optional(),
  createdByRun: z
    .string()
    .regex(/^run_\d{4}-\d{2}-\d{2}(?:-\d+)?$/, 'must look like run_YYYY-MM-DD or run_YYYY-MM-DD-n')
    .optional(),
}

/**
 * `superRefine` params for cross-field checks: run them only once every field is valid. (Zod 4
 * otherwise also runs them after a field's non-aborting issue, such as a failed `.min()`, and a
 * rule like "the ID matches the LeetCode number" would add a second issue for one mistake.)
 */
export const whenFieldsValid = {
  when: (payload: { issues: readonly unknown[] }) => payload.issues.length === 0,
}

/** `createdByRun` names a bot run, so it only comes with `origin: bot`. Every item schema calls it. */
export function checkProvenance(
  item: { origin?: 'bot' | undefined; createdByRun?: string | undefined },
  ctx: z.RefinementCtx,
): void {
  if (item.createdByRun !== undefined && item.origin === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['origin'],
      message: 'createdByRun needs origin: bot',
    })
  }
}
