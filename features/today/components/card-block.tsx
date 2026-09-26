'use client'

import { useState } from 'react'
import { CardSession } from '@/features/items/components/outcome/card-session'
import type { CardSessionCard, RecordOutcome } from '@/features/items/outcome'
import type { BlockItemSlot } from '../slots'
import { BlockItemList } from './block-item-list'

/**
 * A card-only block on `/today` (decision 19): its cards are graded where they are listed, in the
 * items' CardSession (FlashcardView + "Biết" / "Chưa chắc" / "Không biết", keys 1 / 2 / 3 on the
 * card focus is in — two blocks never both take a key). `cards` are the block's cards not handled
 * yet (`todaySlots`); each grade sends `recordOutcome` (unbound, from the page) with the block's id
 * and the render's request id. Whether to show the session is decided once, at mount: a session
 * keeps its own deck to its end state ("Đã ôn xong") while the revalidated page drops the graded
 * cards, and a block whose cards were all handled before the page rendered lists its rows
 * (BlockItemList) instead.
 */
function CardBlock({
  cards,
  items,
  requestId,
  record,
}: {
  cards: readonly CardSessionCard[]
  /** The block's registry rows, for a block with nothing left to grade. */
  items: readonly BlockItemSlot[]
  requestId: string
  record: RecordOutcome
}) {
  const [session] = useState(() => cards.length > 0)
  if (!session) return <BlockItemList items={items} />
  return <CardSession cards={cards} requestId={requestId} record={record} />
}

export { CardBlock }
