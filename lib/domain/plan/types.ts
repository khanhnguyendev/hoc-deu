/**
 * Plans (platform design §4.1 `day_plans`, §5.4): the blocks `buildPlan` produces and
 * `day_plans.blocks` stores, the per-track snapshot stored in `day_plans.roadmap_weeks`, and the
 * inputs of a plan build. The Zod schemas validate the JSON read back from the database (M5).
 */
import { z } from 'zod'
import {
  ITEM_MODES,
  type PlanCatalog,
  type PlanWeeklyTemplate,
  type ThrottleRule,
} from '../catalog'
import type { ItemState } from '../state'
import type { LocalDay } from '../time/localDay'

export const BLOCK_KINDS = ['review', 'new', 'recap', 'practice', 'extra'] as const
export type BlockKind = (typeof BLOCK_KINDS)[number]

export const planBlockItemSchema = z.strictObject({
  itemId: z.string().min(1).max(128),
  mode: z.enum(ITEM_MODES),
  minutes: z.number().min(0).max(600),
  /** The first new item that exceeds the remaining budget ("dài hơn thời gian dự kiến", §5.4). */
  overBudget: z.literal(true).optional(),
})
export type PlanBlockItem = z.infer<typeof planBlockItemSchema>

export const planBlockSchema = z.strictObject({
  /** `<planDate>:<trackId>:<kind>:<n>`, n = 1, 2, … per kind within the track (§5.4 step 8). */
  id: z.string().min(1).max(128),
  trackId: z.string().min(1).max(32),
  kind: z.enum(BLOCK_KINDS),
  /** The sum of the items' minutes; a practice block's fixed length. */
  estMinutes: z.number().min(0).max(600),
  items: z.array(planBlockItemSchema).max(500),
  /** Practice blocks: the template's tag or item type. */
  tag: z.string().min(1).max(32).optional(),
  itemType: z.string().min(1).max(32).optional(),
  /** Recap blocks: the roadmap week whose recap this is (§5.6); null for filler-only recaps. */
  recapWeek: z.number().int().positive().nullable().optional(),
  /** Shadowing blocks: the cards whose example sentences are read aloud (§5.6). */
  shadowing: z.array(z.string().min(1).max(128)).max(10).optional(),
})
export type PlanBlock = z.infer<typeof planBlockSchema>

/** Per-track facts at plan time (`day_plans.roadmap_weeks`): the week snapshot and the throttle. */
export const trackSnapshotSchema = z.strictObject({
  variant: z.string().min(1).max(32),
  week: z.number().int().positive(),
  dueCount: z.number().int().min(0),
  /** The effective new-item cap (§5.5); null = no cap. */
  newPerDay: z.number().int().min(0).nullable(),
  throttled: z.boolean(),
  reviewDebt: z.boolean(),
})
export type TrackSnapshot = z.infer<typeof trackSnapshotSchema>

export const PLAN_MODES = ['baseline', 'resume'] as const
export type PlanMode = (typeof PLAN_MODES)[number]

/** What `buildPlan` / `buildResumePlan` return — a plan not stored yet. */
export type DayPlan = {
  readonly planDate: LocalDay
  readonly mode: PlanMode
  readonly blocks: readonly PlanBlock[]
  readonly tracks: Readonly<Record<string, TrackSnapshot>>
}

/** A `day_plans` row as the engine reads it. */
export type StoredPlan = {
  readonly id: string
  readonly planDate: LocalDay
  readonly version: number
  readonly source: 'baseline' | 'ai'
  /** Set once, when `/today` first renders the plan in the browser (§5.2); null = never seen. */
  readonly seenAt: string | null
  readonly blocks: readonly PlanBlock[]
  readonly tracks: Readonly<Record<string, TrackSnapshot>>
}

/** A `user_tracks` row with every track default resolved (`lib/content/plan-catalog.ts`, 4.10). */
export type Enrollment = {
  readonly trackId: string
  readonly variant: string
  readonly status: 'active' | 'paused' | 'removed'
  readonly startDate: LocalDay
  readonly budgetMinutes: number
  /** Null = no daily cap on new SRS items. */
  readonly newPerDay: number | null
  readonly throttle: readonly ThrottleRule[]
  readonly weeklyTemplate: PlanWeeklyTemplate
  readonly includeBonus: boolean
  /** The local day of the last `track.reset` (4.9b); plans before it do not count (4.3). */
  readonly resetOn: LocalDay | null
}

/** Everything `buildPlan` reads (§5.4) — loaded by M5's `ensurePlan`, never by the engine. */
export type PlanContext = {
  readonly planDate: LocalDay
  readonly catalog: PlanCatalog
  readonly enrollments: readonly Enrollment[]
  /** Every `item_state` row of the user, all tracks (derived cards unlock from other tracks). */
  readonly items: Readonly<Record<string, ItemState>>
  /** Track → roadmap weeks whose recap is done (`recapWeeksDone`, 4.3). */
  readonly recapDone: Readonly<Record<string, ReadonlySet<number>>>
}
