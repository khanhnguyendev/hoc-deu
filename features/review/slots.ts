/**
 * `/review`'s other due items as a ReactNode slot (the roadmap's fix-5 pattern, as
 * `features/today/slots.ts`): the page renders each one's row through the registry (`reviewRows`,
 * server-only) and hands the slots to ReviewList, so the components here never import the
 * registry and render in the client catalog with plain nodes. Types only.
 */
import type * as React from 'react'

/** One due, non-flashcard item: its registry row (mode, href, "Chưa có ghi chú" and, when Weak,
 *  the "Yếu" pill — all inside the row's own link, task 5.3 review, findings M4/M5). */
export type ReviewItemSlot = {
  readonly itemId: string
  readonly row: React.ReactNode
}
