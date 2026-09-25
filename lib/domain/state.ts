/**
 * Derived state (platform design §4.1): the rows of `item_state`, `plan_block_state` and
 * `daily_activity` as the engine sees them — no `version` / `rules_version`, which are persistence
 * concerns (`lib/events/derived.ts`, task 4.9b). `projection/project.ts` computes them from events.
 */
import type { LocalDay } from './time/localDay'

/** §5.7 status; no row = not started. */
export const ITEM_STATE_STATUSES = ['weak', 'ok', 'strong', 'mastered', 'skipped'] as const
export type ItemStateStatus = (typeof ITEM_STATE_STATUSES)[number]

export type ItemState = {
  readonly itemId: string
  readonly trackId: string
  readonly topicId: string | null
  readonly itemType: string
  /** SRS level 1…N; 0 = not in spaced repetition (completion-only or skipped items). */
  readonly level: number
  readonly weak: boolean
  readonly topSuccesses: number
  readonly status: ItemStateStatus
  /** The next review day; null when not scheduled (completion-only, skipped, mastered). */
  readonly dueOn: LocalDay | null
  /** The raw result of the last counted outcome: `solved`, `know`, `pass`, `completed`, … */
  readonly lastResult: string | null
  readonly lastResultOn: LocalDay | null
  /** The local day of the first recorded outcome, `item.skipped` included (§5.3). */
  readonly introducedOn: LocalDay
  readonly lapses: number
  readonly reps: number
}

export const CHECK_IN_STATUSES = ['done', 'partial', 'skipped'] as const
export type CheckInStatus = (typeof CHECK_IN_STATUSES)[number]

export type BlockState = {
  readonly planId: string
  readonly blockId: string
  readonly trackId: string
  readonly status: CheckInStatus
  readonly minutes: number
  readonly note: string | null
  readonly auto: boolean
  /** The local day of the block's first check-in: the `daily_activity` day it counts for. */
  readonly checkedInOn: LocalDay
}

export type DailyActivity = {
  readonly localDay: LocalDay
  readonly minutesByTrack: Readonly<Record<string, number>>
  /** Distinct items with a counted outcome that day. */
  readonly itemsDone: number
  /** At least one block checked in `done` or `partial` that day (§4.1). */
  readonly completed: boolean
}

export type DerivedState = {
  readonly items: Readonly<Record<string, ItemState>>
  /** Keyed by `blockKey(planId, blockId)`. */
  readonly blocks: Readonly<Record<string, BlockState>>
  readonly days: Readonly<Record<LocalDay, DailyActivity>>
}

export const EMPTY_DERIVED_STATE: DerivedState = { items: {}, blocks: {}, days: {} }

export function blockKey(planId: string, blockId: string): string {
  return `${planId}/${blockId}`
}
