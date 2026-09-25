/**
 * The plan engine's view of the content catalog (platform design §3, §5): what the engine reads
 * about tracks, roadmaps and items, already resolved — SRS parameters per item (track `srs` plus
 * `srs.byType`) and minutes per mode (manifest `estimates` / `review`). `lib/domain` never imports
 * `lib/content`: `lib/content/plan-catalog.ts` (task 4.10) builds this from the generated catalog,
 * the simulation builds it from its inputs (4.8), and tests build it by hand
 * (`plan/__tests__/fixtures.ts`).
 */

export type ContentStatus = 'draft' | 'active' | 'retired'

/** How an item is studied in a plan block (§5.4, §5.5); `lib/content` `Mode` has the same members. */
export const ITEM_MODES = ['new', 'review', 'recall', 'redo', 'explain-aloud'] as const
export type ItemMode = (typeof ITEM_MODES)[number]

export type SrsParams = {
  readonly intervals: readonly number[]
  readonly relearnDays: number
  readonly masteredAfter: number
}

export type Difficulty = 'E' | 'M' | 'H'
export type CardTier = 'core' | 'extended' | 'derived'

export type PlanItem = {
  readonly id: string
  readonly trackId: string
  /** Compared by equality only (a practice block's `itemType`); never switched on (§7.2). */
  readonly itemType: string
  readonly topicId: string | null
  /** The authored week: a card's deck, an exercise, a weekly prompt; otherwise null. */
  readonly week: number | null
  readonly status: ContentStatus
  /** Resolved SRS parameters, or null for completion-only item types (§5.7 `srs: true`). */
  readonly srs: SrsParams | null
  /** Minutes per mode (§5.4 estimates; decision 12 of Part B-M3 for explain-aloud). */
  readonly minutes: Readonly<Record<ItemMode, number>>
  /** Problems: reviewed by quick recall, or redo when Weak (§5.5). Cards: plain review. */
  readonly reviewModes: boolean
  readonly difficulty: Difficulty | null
  readonly tier: CardTier | null
  readonly deckId: string | null
  /** A derived card's source item (§3.4); null otherwise. */
  readonly derivedFrom: string | null
  /** A deep-dive lesson's problem (§3.3 `about`); null for a pattern lesson and non-lessons. */
  readonly about: string | null
  /** A problem's deep-dive lesson (§5.4 step 3), whatever that lesson's status; null otherwise. */
  readonly deepDiveId: string | null
  /** Prompts: the tag a practice block picks them by. */
  readonly tag: string | null
  /** Prompts: repeatable ones (the mock interview) have no week. */
  readonly repeatable: boolean
  /** Cards with an example sentence (shadowing, §5.6). */
  readonly hasExample: boolean
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type TemplateDayKey = 'mon-fri' | Weekday

/** A weekly-template block (§3.4, §5.4) — the manifest's `templateBlockSchema`, as data. */
export type PlanTemplateBlock =
  | { readonly kind: 'review'; readonly maxMinutes?: number; readonly fromWeek?: number }
  | { readonly kind: 'new'; readonly fromWeek?: number }
  | { readonly kind: 'recap'; readonly count: number; readonly fromWeek?: number }
  | {
      readonly kind: 'practice'
      readonly minutes: number
      readonly tag?: string
      readonly itemType?: string
      readonly fromWeek?: number
    }

export type PlanWeeklyTemplate = Readonly<
  Partial<Record<TemplateDayKey, readonly PlanTemplateBlock[]>>
>

export type ThrottleRule = { readonly dueAbove: number; readonly newPerDay: number }

export type RecapMode = 'recall' | 'redo' | 'explain-aloud'

export type PlanRoadmapWeek = {
  readonly week: number
  readonly topics: readonly string[]
  readonly core: readonly string[]
  readonly bonus: readonly string[]
  /** An entry without a mode introduces its item (§5.3 step 3). */
  readonly recap: readonly { readonly item: string; readonly mode?: RecapMode }[]
  /** Deck IDs; their `core` / `extended` cards belong to this week. */
  readonly decks: readonly string[]
}

export type PlanRoadmap = { readonly id: string; readonly weeks: readonly PlanRoadmapWeek[] }

export type PlanTrack = {
  readonly id: string
  readonly status: ContentStatus
  readonly weeklyTemplate: PlanWeeklyTemplate
  readonly defaults: {
    readonly budgetMinutes: number
    readonly newPerDay: number | null
    readonly throttle: readonly ThrottleRule[]
  }
  /** Variant → roadmap, for the roadmap files that exist (a missing one is coverage, M3 dec. 4). */
  readonly roadmaps: Readonly<Record<string, PlanRoadmap>>
}

/** An authored deck; `cardIds` in file order. Derived decks are not listed (their cards are). */
export type PlanDeck = {
  readonly id: string
  readonly trackId: string
  readonly status: ContentStatus
  readonly cardIds: readonly string[]
}

export type PlanCatalog = {
  readonly tracks: Readonly<Record<string, PlanTrack>>
  readonly items: Readonly<Record<string, PlanItem>>
  readonly decks: Readonly<Record<string, PlanDeck>>
}
