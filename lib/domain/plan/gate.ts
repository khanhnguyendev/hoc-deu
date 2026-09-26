/**
 * Gate rule on the last **seen** plan (platform design §5.2, §5.8, §5.9; ADR-0016): whether the
 * roadmap may advance today, and the stale-plan "Học tiếp hôm nay" offer. `plan/resume.ts` (4.6)
 * builds the resume plan; this module only reads history.
 */
import { blockKey, type BlockState, isDoneOrPartial } from '../state'
import { daysBetween, type LocalDay } from '../time/localDay'
import type { PlanBlock, StoredPlan } from './types'

/** "Học tiếp hôm nay" is offered when the last seen plan is more than this many days old (§5.8). */
export const RESUME_AFTER_DAYS = 2

export type GateStatus =
  | {
      readonly open: true
      readonly lastSeen: StoredPlan | null
      /** The last seen plan (from an earlier day) got its first `done` / `partial` check-in today:
       *  resuming counts as today's work, so no new plan is built today (§5.2, §5.9; decision 32). */
      readonly resumedToday: boolean
    }
  | {
      readonly open: false
      readonly lastSeen: StoredPlan
      /** daysBetween(lastSeen.planDate, today). */
      readonly daysSince: number
      readonly offerResume: boolean
    }

/** The seen plan with the latest planDate before `today` (§5.2); unseen plans never count. */
export function lastSeenPlan(plans: readonly StoredPlan[], today: LocalDay): StoredPlan | null {
  let best: StoredPlan | null = null
  for (const candidate of plans) {
    if (candidate.seenAt === null) continue
    if (candidate.planDate >= today) continue
    // LocalDay is a zero-padded `YYYY-MM-DD` string, so string order is chronological order.
    if (best === null || candidate.planDate > best.planDate) best = candidate
  }
  return best
}

/** The local day of the earliest of `states` (LocalDay strings sort chronologically). */
function earliestCheckedInOn(states: readonly BlockState[]): LocalDay {
  let earliest = states[0]?.checkedInOn
  for (const state of states) {
    if (earliest === undefined || state.checkedInOn < earliest) earliest = state.checkedInOn
  }
  // states is never empty when this is called.
  return earliest as LocalDay
}

/** Open when there is no last seen plan, when it has no blocks (nothing could be done — RF-4), or
 *  when any of its blocks is checked in `done` or `partial` (at any time) — `resumedToday` when the
 *  earliest `checkedInOn` of those blocks is `today`. Closed otherwise, with `offerResume` when
 *  `daysSince > RESUME_AFTER_DAYS`. */
export function gateStatus(
  plans: readonly StoredPlan[],
  blocks: Readonly<Record<string, BlockState>>,
  today: LocalDay,
): GateStatus {
  const lastSeen = lastSeenPlan(plans, today)
  if (lastSeen === null) return { open: true, lastSeen: null, resumedToday: false }
  if (lastSeen.blocks.length === 0) return { open: true, lastSeen, resumedToday: false }

  const finishedStates: BlockState[] = []
  for (const block of lastSeen.blocks) {
    const state = blocks[blockKey(lastSeen.id, block.id)]
    if (state !== undefined && isDoneOrPartial(state.status)) finishedStates.push(state)
  }

  if (finishedStates.length > 0) {
    return {
      open: true,
      lastSeen,
      resumedToday: earliestCheckedInOn(finishedStates) === today,
    }
  }

  const daysSince = daysBetween(lastSeen.planDate, today)
  return { open: false, lastSeen, daysSince, offerResume: daysSince > RESUME_AFTER_DAYS }
}

/** The plan's blocks without a `done` / `partial` check-in, in plan order (the paused view, M5). */
export function unfinishedBlocks(
  plan: StoredPlan,
  blocks: Readonly<Record<string, BlockState>>,
): PlanBlock[] {
  return plan.blocks.filter((block) => {
    const state = blocks[blockKey(plan.id, block.id)]
    return state === undefined || !isDoneOrPartial(state.status)
  })
}
