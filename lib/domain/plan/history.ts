/** Recap history (platform design §5.6): which roadmap weeks' recap a track has done. */
import { blockKey, type BlockState, isDoneOrPartial } from '../state'
import type { Enrollment, StoredPlan } from './types'

/** Track → roadmap weeks whose recap is done (§5.6): a `recap` block of that track with a
 *  `recapWeek`, checked in `done` or `partial`, in a plan whose `tracks[trackId].variant` is the
 *  enrollment's current variant and whose planDate is on or after the enrollment's `resetOn`.
 *  Every enrollment gets an entry (possibly empty). */
export function recapWeeksDone(
  plans: readonly StoredPlan[],
  blocks: Readonly<Record<string, BlockState>>,
  enrollments: readonly Enrollment[],
): Record<string, Set<number>> {
  const result: Record<string, Set<number>> = {}
  for (const enrollment of enrollments) {
    result[enrollment.trackId] = new Set<number>()
  }

  for (const plan of plans) {
    for (const block of plan.blocks) {
      if (block.kind !== 'recap') continue
      if (block.recapWeek === null || block.recapWeek === undefined) continue

      const enrollment = enrollments.find((candidate) => candidate.trackId === block.trackId)
      if (enrollment === undefined) continue

      const snapshot = plan.tracks[block.trackId]
      if (snapshot === undefined || snapshot.variant !== enrollment.variant) continue
      if (enrollment.resetOn !== null && plan.planDate < enrollment.resetOn) continue

      const state = blocks[blockKey(plan.id, block.id)]
      if (state === undefined || !isDoneOrPartial(state.status)) continue

      result[enrollment.trackId]?.add(block.recapWeek)
    }
  }

  return result
}
