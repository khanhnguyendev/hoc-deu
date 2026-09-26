/**
 * Item results on item pages (platform design §3.2, §4.4, §5.5–§5.7; Part B-M5 task 5.2c,
 * decisions 14 and 16–19; ADR-0036): what the item route hands a Page's result controls
 * (`OutcomeBinding`), the card session's props, and how the page's mode is chosen
 * (`resolveMode`). Types and pure functions only — client components import it; the server
 * action arrives as a prop (`record`), never through an import.
 */
import type { Outcome, OutcomeInput, OutcomeResult } from '@/features/checkin'
import type { ItemMode, PlanItem } from '@/lib/domain/catalog'
import { reviewMode } from '@/lib/domain/plan/reviewMode'
import type { ItemState } from '@/lib/domain/state'
import type { LocalDay } from '@/lib/domain/time/localDay'
import type { FlashcardSides } from './components/flashcard-view'
import type { ItemStateView, Mode } from './types'

export type { FlashcardSides } from './components/flashcard-view'
export type { Outcome, OutcomeInput, OutcomeResult }

/**
 * The server action itself (`recordOutcome`, 5.2a), passed **unbound** as a prop from the page (a
 * bound action would send `(ctx, outcome)` and lose the outcome); the client builds the
 * `OutcomeInput`.
 */
export type RecordOutcome = (input: OutcomeInput) => Promise<OutcomeResult>

export type OutcomeBinding = {
  readonly mode: Mode
  /** Set when the item is in the dashboard's current plan (decision 14). */
  readonly plan: { readonly blockId: string; readonly label: string } | null
  readonly state: ItemStateView | null
  /** Due for review today (§5.7): "Bỏ qua mục này" shows while not introduced or due. */
  readonly due: boolean
  /** The page's per-render id (decision 16). */
  readonly requestId: string
  readonly itemId: string
  readonly blockId?: string
  readonly record: RecordOutcome
}

/** What the loader computes (`getItemPage`); the route adds `record`, the server action. */
export type OutcomeContext = Omit<OutcomeBinding, 'record'>

export type CardSessionCard = {
  readonly itemId: string
  readonly sides: FlashcardSides
  readonly blockId?: string
}

export type CardSessionProps = {
  /** Kept in component state from mount: a revalidation that drops a graded card never shifts the
   *  session (decision 19). */
  readonly cards: readonly CardSessionCard[]
  readonly requestId: string
  readonly record: RecordOutcome
}

const PROBLEM_MODES: readonly ItemMode[] = ['new', 'recall', 'redo', 'explain-aloud']
const OTHER_MODES: readonly ItemMode[] = ['new', 'review']

/**
 * The modes an item's page can be opened in: a problem is new, recalled, redone or explained
 * aloud (§5.5, §5.6); every other item is new or reviewed (a due card, an introduced practice
 * item). Read from the catalog's flags, never from the item type (§7.2).
 */
export function modesFor(item: PlanItem): readonly ItemMode[] {
  return item.reviewModes ? PROBLEM_MODES : OTHER_MODES
}

/** Due today, as the due queue counts it (§5.4 step 3): an SRS item, not mastered or skipped. */
export function isDue(item: PlanItem, state: ItemState, today: LocalDay): boolean {
  return (
    item.srs !== null &&
    state.dueOn !== null &&
    // LocalDay is a zero-padded `YYYY-MM-DD` string: string order is chronological order.
    state.dueOn <= today &&
    state.status !== 'mastered' &&
    state.status !== 'skipped'
  )
}

/** `mode` when the item can be studied in it, else null. */
function validMode(item: PlanItem, mode: string | null | undefined): ItemMode | null {
  return modesFor(item).find((candidate) => candidate === mode) ?? null
}

/**
 * `?mode=` when valid for the item; else the current plan block's mode for it (when valid); else
 * the review mode of an introduced, due SRS item (reviewMode); else 'new'.
 */
export function resolveMode(input: {
  readonly item: PlanItem
  readonly requested: string | undefined
  readonly planMode: ItemMode | null
  readonly state: ItemState | null
  readonly today: LocalDay
}): ItemMode {
  const { item, requested, planMode, state, today } = input
  const chosen = validMode(item, requested) ?? validMode(item, planMode)
  if (chosen !== null) return chosen
  if (state !== null && isDue(item, state, today)) return reviewMode(item, state)
  return 'new'
}

/** The item-wide actions (§5.7): skip while not introduced or due; re-add a mastered item. */
export function itemActionsFor(binding: Pick<OutcomeBinding, 'state' | 'due'>): {
  readonly skip: boolean
  readonly readd: boolean
} {
  return {
    skip: binding.state === null || binding.due,
    readd: binding.state?.status === 'mastered',
  }
}

/** The `OutcomeInput` a control sends: the render's request id, the item, its block when any. */
export function outcomeInput(
  target: Pick<OutcomeBinding, 'requestId' | 'itemId' | 'blockId'>,
  outcome: Outcome,
): OutcomeInput {
  const { requestId, itemId, blockId } = target
  return blockId === undefined
    ? { requestId, itemId, outcome }
    : { requestId, itemId, blockId, outcome }
}
