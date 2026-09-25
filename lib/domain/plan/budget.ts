/**
 * Budget rules for building a plan (platform design §5.4 steps 2-5, §5.5, §5.10, decision 13):
 * fixed blocks, the review cap and review debt, and the two selection strategies a block's
 * candidates go through — skip-what-does-not-fit (reviews and recap) and take-first-then-half-fit
 * (new items).
 */
import type { ItemMode } from '../catalog'

/** One unit a block may take: an item, or a deep-dive lesson (`lead`) and its problem together. */
export type Candidate = {
  readonly itemId: string
  readonly mode: ItemMode
  readonly minutes: number
  /** A new SRS item: counts toward the new-item cap (§5.5). */
  readonly srs: boolean
  /** Placed right before this item and taken or skipped with it (§5.4 step 3). */
  readonly lead?: Candidate
}

export type Picked = {
  readonly itemId: string
  readonly mode: ItemMode
  readonly minutes: number
  readonly overBudget?: true
}

export type Selection = {
  /** Flattened: a unit's lead comes right before its item. */
  readonly picked: readonly Picked[]
  readonly minutes: number
  /** A forced unit exceeded the remaining budget (the track's one overshoot, decision 13). */
  readonly overshoot: boolean
}

export const EMPTY_SELECTION: Selection = { picked: [], minutes: 0, overshoot: false }

/** A track's budget while its plan is built. `remaining` may go negative after the overshoot. */
export type BudgetState = { readonly remaining: number; readonly overshootUsed: boolean }

export function startBudget(minutes: number): BudgetState {
  return { remaining: minutes, overshootUsed: false }
}

/**
 * `remaining − selection.minutes`; `overshootUsed ||= selection.overshoot || the new remaining <
 * 0` (a half-fit unit that overshoots uses the track's one overshoot too — decision 13).
 */
export function spend(budget: BudgetState, selection: Selection): BudgetState {
  const remaining = budget.remaining - selection.minutes
  return {
    remaining,
    overshootUsed: budget.overshootUsed || selection.overshoot || remaining < 0,
  }
}

/** §5.10 review debt: an item more than `overdueDays` overdue raises the weekday cap to
 *  `capShare` of the track budget. */
export const REVIEW_DEBT = { overdueDays: 7, capShare: 0.4 } as const

export function inReviewDebt(overdueDays: readonly number[]): boolean {
  return overdueDays.some((days) => days > REVIEW_DEBT.overdueDays)
}

/**
 * A review block's cap (§5.4 step 3): `min(remaining, limit)`, never below 0, where `limit` = ∞
 * without `maxMinutes`; `maxMinutes`; or `max(maxMinutes, capShare × trackBudget)` in debt.
 */
export function reviewCap(input: {
  readonly maxMinutes: number | undefined
  readonly trackBudget: number
  readonly remaining: number
  readonly debt: boolean
}): number {
  const limit =
    input.maxMinutes === undefined
      ? Infinity
      : input.debt
        ? Math.max(input.maxMinutes, REVIEW_DEBT.capShare * input.trackBudget)
        : input.maxMinutes
  return Math.max(0, Math.min(input.remaining, limit))
}

/**
 * A fixed block (§5.4 step 2): taken when it fits; otherwise taken as the overshoot while it is
 * unused (`overshoot: true`); otherwise dropped.
 */
export function reserveFixed(
  budget: BudgetState,
  minutes: number,
): { readonly take: boolean; readonly overshoot: boolean } {
  if (minutes <= budget.remaining) return { take: true, overshoot: false }
  if (!budget.overshootUsed) return { take: true, overshoot: true }
  return { take: false, overshoot: false }
}

function pickUnit(candidate: Candidate, overBudget: boolean): Picked[] {
  const flag = overBudget ? ({ overBudget: true } as const) : {}
  const items: Picked[] = []
  if (candidate.lead) {
    items.push({
      itemId: candidate.lead.itemId,
      mode: candidate.lead.mode,
      minutes: candidate.lead.minutes,
      ...flag,
    })
  }
  items.push({
    itemId: candidate.itemId,
    mode: candidate.mode,
    minutes: candidate.minutes,
    ...flag,
  })
  return items
}

const unitMinutes = (candidate: Candidate): number =>
  (candidate.lead?.minutes ?? 0) + candidate.minutes

/**
 * Reviews and recap (§5.4 steps 3-4): in order, a unit is taken when its minutes (lead included)
 * fit `cap − used`, otherwise skipped; with `forceFirst` the first candidate is taken whatever it
 * costs (its items flagged `overBudget` and `overshoot: true` when it does not fit). At most
 * `maxUnits` units (default: no limit).
 */
export function selectSkipping(
  candidates: readonly Candidate[],
  options: { readonly cap: number; readonly maxUnits?: number; readonly forceFirst?: boolean },
): Selection {
  const maxUnits = options.maxUnits ?? Infinity
  const picked: Picked[] = []
  let used = 0
  let overshoot = false
  let taken = 0

  for (let index = 0; index < candidates.length && taken < maxUnits; index += 1) {
    const candidate = candidates[index]
    if (candidate === undefined) continue
    const cost = unitMinutes(candidate)
    const fits = cost <= options.cap - used
    const forced = index === 0 && options.forceFirst === true
    if (!fits && !forced) continue

    const overBudget = forced && !fits
    picked.push(...pickUnit(candidate, overBudget))
    used += cost
    taken += 1
    if (overBudget) overshoot = true
  }

  return { picked, minutes: used, overshoot }
}

/**
 * New items (§5.4 step 5): the first unit is taken whatever it costs when `forceFirst` (flagged
 * `overBudget` + `overshoot` if it does not fit); each following unit when at least half of it
 * fits (`remaining − used ≥ minutes / 2`); the first unit that fails stops the selection — order
 * is never broken. SRS units stop at `newCap` (null = no cap); `newCap` 0 → no SRS unit, even
 * with `forceFirst`.
 */
export function selectHalfFit(
  candidates: readonly Candidate[],
  options: {
    readonly remaining: number
    readonly newCap: number | null
    readonly forceFirst: boolean
  },
): Selection {
  const picked: Picked[] = []
  let used = 0
  let overshoot = false
  let srsTaken = 0

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]
    if (candidate === undefined) continue
    if (candidate.srs && options.newCap !== null && srsTaken >= options.newCap) break

    const cost = unitMinutes(candidate)
    const left = options.remaining - used
    const forced = index === 0 && options.forceFirst
    const fits = forced || left >= cost / 2
    if (!fits) break

    const overBudget = forced && left < cost
    picked.push(...pickUnit(candidate, overBudget))
    used += cost
    if (candidate.srs) srsTaken += 1
    if (overBudget) overshoot = true
  }

  return { picked, minutes: used, overshoot }
}
