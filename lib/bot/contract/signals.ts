/**
 * The `content-signals` contract of the bot API (§6.4.7; Part B-M6 decision 19; task 6.7a): the
 * input of the shared content loop. **Aggregates only** — item, track and deck IDs, weeks, counts
 * and rates; never a user, a ref or anything a learner wrote. Every object is strict, so a field
 * that could carry more than that cannot slip into the answer. The server's route and M7's `pnpm
 * bot` CLI both import it, so it imports only `zod` (decision 3).
 */
import { z } from 'zod'

const itemId = z.string().regex(/^[a-z][a-z0-9-]{0,31}:[a-z0-9:-]{1,120}$/)
const rate = z.number().min(0).max(1)
const count = z.number().int().min(0)

/** An item at least 5 distinct learners answered in the last 90 days that they often fail. */
export const highFailSignal = z.strictObject({
  itemId,
  attempts: count,
  /** `failed` / `dont_know` results over attempts, two decimals. */
  failRate: rate,
  /** `hint` / `unsure` results over attempts, two decimals. */
  hintRate: rate,
  /** A deep-dive lesson about the problem exists (§3.5 reverse lookup). */
  hasDeepDive: z.boolean(),
})

/**
 * Content a learner reaches within 14 days that does not exist (or is not active): a placed
 * problem's `note` or `deep-dive` (`itemId`, the problem), a week topic's pattern `lesson`
 * (`topic`). `neededWithinDays`: 0 for a learner's current week, 7 per week ahead.
 */
export const missingSignal = z.union([
  z.strictObject({
    trackId: z.string(),
    week: z.number().int().min(1),
    kind: z.enum(['note', 'deep-dive']),
    itemId,
    neededWithinDays: count,
  }),
  z.strictObject({
    trackId: z.string(),
    week: z.number().int().min(1),
    kind: z.literal('lesson'),
    topic: z.string(),
    neededWithinDays: count,
  }),
])

/** An English week a learner reaches within 14 days that has no `extended` card. */
export const englishGapSignal = z.strictObject({
  week: z.number().int().min(1),
  extendedCards: count,
})

/** A derived deck (§3.5) that has no active card yet for placed problems learners reach soon. */
export const derivedDeckGapSignal = z.strictObject({
  deckId: z.string(),
  missingFor: z.array(itemId),
})

export const contentSignalsResponse = z.strictObject({
  highFail: z.array(highFailSignal),
  missing: z.array(missingSignal),
  englishGaps: z.array(englishGapSignal),
  derivedDeckGaps: z.array(derivedDeckGapSignal),
  /**
   * Already on their way (§6.6), as plain strings of two kinds: the target IDs of pending publish
   * requests (`<itemId>` or `<itemId>#note`), sorted, then — when today's plan run has one — its
   * content PR URL (`https://github.com/<repository>/pull/<n>`), last. (`missing` is the other
   * mixed list: its `lesson` entries carry `topic` instead of `itemId`.)
   */
  openProposals: z.array(z.string()),
})

export type HighFailSignal = z.infer<typeof highFailSignal>
export type MissingSignal = z.infer<typeof missingSignal>
export type EnglishGapSignal = z.infer<typeof englishGapSignal>
export type DerivedDeckGapSignal = z.infer<typeof derivedDeckGapSignal>
export type ContentSignals = z.infer<typeof contentSignalsResponse>
