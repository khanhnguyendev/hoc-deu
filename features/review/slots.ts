/**
 * `/review`'s other due items as a ReactNode slot (the roadmap's fix-5 pattern, as
 * `features/today/slots.ts`): the page renders each one's row through the registry (`reviewRows`,
 * server-only) and hands the slots to ReviewList, so the components here never import the
 * registry and render in the client catalog with plain nodes. Types only.
 */
import type * as React from 'react'

/** One due, non-flashcard item: its registry row, and whether it is Weak (a pill under the row —
 *  the registry's own status pill would need the full learner state `ReviewEntry` does not carry,
 *  as `BlockItemSlot.noNote` is a pill `todaySlots` adds beside a problem's row). */
export type ReviewItemSlot = {
  readonly itemId: string
  readonly row: React.ReactNode
  readonly weak: boolean
}
