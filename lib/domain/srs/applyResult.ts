/**
 * SRS transitions (platform design §5.7): the level/weak/topSuccesses/dueOn table, `srsStatus`
 * and `item.readded`. Pure: no clock reads, `day` is always the caller's local day.
 */
import type { SrsParams } from '../catalog'
import type { ItemState, ItemStateStatus } from '../state'
import { addDays, type LocalDay } from '../time/localDay'
import type { Outcome } from './outcomes'

/** The spaced-repetition fields of an item's state (§5.7). */
export type SrsState = Pick<
  ItemState,
  'level' | 'weak' | 'topSuccesses' | 'status' | 'dueOn' | 'lastResultOn' | 'lapses' | 'reps'
>

/** An item with no row yet (§5.7 "not started"). */
export const NOT_STARTED: SrsState = {
  level: 0,
  weak: false,
  topSuccesses: 0,
  status: 'ok',
  dueOn: null,
  lastResultOn: null,
  lapses: 0,
  reps: 0,
}

/**
 * Weak → 'weak'; level ≥ N with topSuccesses ≥ masteredAfter → 'mastered'; level ≥ 3 → 'strong';
 * else 'ok' (N = params.intervals.length).
 */
export function srsStatus(
  level: number,
  weak: boolean,
  topSuccesses: number,
  params: SrsParams,
): Exclude<ItemStateStatus, 'skipped'> {
  if (weak) return 'weak'
  const n = params.intervals.length
  if (level >= n && topSuccesses >= params.masteredAfter) return 'mastered'
  if (level >= 3) return 'strong'
  return 'ok'
}

/** `params.intervals[index]`, guarding the `noUncheckedIndexedAccess` read for a valid index. */
function intervalAt(params: SrsParams, index: number): number {
  const interval = params.intervals[index]
  if (interval === undefined) {
    throw new Error(`SrsParams.intervals has no entry at index ${index}`)
  }
  return interval
}

/**
 * One result on `day` (the local day of the result, §5.7). Returns `state` itself (the same
 * object) when `state.lastResultOn === day` — only the first result per item per day counts.
 */
export function applyResult(
  state: SrsState,
  outcome: Outcome,
  day: LocalDay,
  params: SrsParams,
): SrsState {
  if (state.lastResultOn === day) return state

  // A level above N after the manifest shortened its intervals is treated as N; level 0 is "not
  // started" whatever the status, so a skipped item that gets a result starts SRS.
  const n = params.intervals.length
  const level = Math.min(state.level, n)

  let newLevel: number
  let weak: boolean
  let topSuccesses: number
  let lapses: number
  let dueOn: LocalDay

  if (level === 0) {
    newLevel = 1
    weak = outcome === 'fail'
    topSuccesses = 0
    lapses = state.lapses
    dueOn =
      outcome === 'fail' ? addDays(day, params.relearnDays) : addDays(day, intervalAt(params, 0))
  } else if (outcome === 'fail') {
    newLevel = 1
    weak = true
    topSuccesses = 0
    lapses = state.lapses + 1
    dueOn = addDays(day, params.relearnDays)
  } else if (outcome === 'partial') {
    newLevel = level
    weak = state.weak
    topSuccesses = state.topSuccesses
    lapses = state.lapses
    dueOn = addDays(day, intervalAt(params, level - 1))
  } else if (level < n) {
    newLevel = level + 1
    weak = false
    topSuccesses = state.topSuccesses
    lapses = state.lapses
    dueOn = addDays(day, intervalAt(params, level))
  } else {
    newLevel = n
    weak = false
    topSuccesses = state.topSuccesses + 1
    lapses = state.lapses
    dueOn = addDays(day, intervalAt(params, n - 1))
  }

  const status = srsStatus(newLevel, weak, topSuccesses, params)

  return {
    level: newLevel,
    weak,
    topSuccesses,
    status,
    dueOn: status === 'mastered' ? null : dueOn,
    lastResultOn: day,
    lapses,
    reps: state.reps + 1,
  }
}

/**
 * `item.readded` (§5.7): a mastered item back at the top level, due `day`, topSuccesses 0. Any
 * other state is returned unchanged (the same object). Not a result: lastResultOn and reps stay.
 */
export function readd(state: SrsState, day: LocalDay, params: SrsParams): SrsState {
  if (state.status !== 'mastered') return state

  const n = params.intervals.length
  const level = Math.min(state.level, n)

  return {
    level,
    weak: false,
    topSuccesses: 0,
    status: srsStatus(level, false, 0, params),
    dueOn: day,
    lastResultOn: state.lastResultOn,
    lapses: state.lapses,
    reps: state.reps,
  }
}
