/** How a due item is reviewed (platform design §5.5) — shared by the due queue and the recap. */
import type { ItemMode, PlanItem } from '../catalog'
import type { ItemState } from '../state'

/** Problems (`reviewModes`): redo when Weak, quick recall otherwise. Anything else: 'review'. */
export function reviewMode(item: PlanItem, state: ItemState): ItemMode {
  if (!item.reviewModes) return 'review'
  return state.weak ? 'redo' : 'recall'
}
