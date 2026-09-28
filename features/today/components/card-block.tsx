'use client'

import { useState } from 'react'
import { CardSession } from '@/features/items/components/outcome/card-session'
import type { CardSessionCard, RecordOutcome } from '@/features/items/outcome'
import type { BlockItemSlot } from '../slots'
import { BlockItemList } from './block-item-list'

type CardBlockProps = {
  /** The block's cards not handled yet (`todaySlots`), in block order. */
  cards: readonly CardSessionCard[]
  /** The block's registry rows, for a block with nothing left to grade. */
  items: readonly BlockItemSlot[]
  requestId: string
  record: RecordOutcome
  /** The rendered plan's id and version (decision 36): each grade sends them, and another plan
   *  or version answers "stale". Omitted in catalog demos. */
  plan?: { readonly id: string; readonly version: number }
}

type CardDeckProps = CardBlockProps & {
  revealed: string | null
  onRevealChange: (itemId: string, open: boolean) => void
}

/** One deck of the block: "session or rows" and the session's own deck are decided at mount. */
function CardDeck({ cards, items, requestId, record, revealed, onRevealChange }: CardDeckProps) {
  const [session] = useState(() => cards.length > 0)
  if (!session) return <BlockItemList items={items} />
  return (
    <CardSession
      cards={cards}
      requestId={requestId}
      record={record}
      headingLevel={4}
      revealVariant="outline"
      initialRevealed={revealed}
      onRevealChange={onRevealChange}
    />
  )
}

/**
 * A card-only block on `/today` (decision 19): its cards are graded where they are listed, in the
 * items' CardSession (FlashcardView + "Biết" / "Chưa chắc" / "Không biết", keys 1 / 2 / 3 on the
 * card focus is in — two blocks never both take a key). Under the block's `h3`, the card front is
 * an `h4` (parked #7), and "Xem nghĩa" is `outline`: the block's "Check-in" is the view's primary
 * (DESIGN_SYSTEM §9, §12; m-12). `cards` are the block's cards not handled yet (`todaySlots`); each
 * grade sends `recordOutcome` (unbound, from the page) with the block's id, the render's request
 * id and the rendered plan's id and version (decision 36). While the block's items stay the same, the deck is the one from mount: a session keeps its
 * deck to its end state ("Đã ôn xong") while the revalidated page drops the graded cards, and a
 * block whose cards were all handled before the page rendered lists its rows (BlockItemList). When
 * the block grows — "Học thêm" on English, an off-plan result landing in the extra block (ruling
 * M5-R33 I-1) — the deck starts again from the page's cards: the ones not handled yet, the current
 * card first — still revealed if it was (parked #8) — then the appended ones, so they are graded
 * here without a reload. Growth comes from outside the block (the "Học thêm" button, another
 * page), so focus is elsewhere and stays there; that button's own live region announces the
 * addition.
 */
function CardBlock({ plan, record, ...props }: CardBlockProps) {
  // The revealed card outlives a deck remount: the block (not the deck) remembers it.
  const [revealed, setRevealed] = useState<string | null>(null)
  const onRevealChange = (itemId: string, open: boolean) => {
    setRevealed((current) => (open ? itemId : current === itemId ? null : current))
  }
  // Blocks only grow by appending (plan.extra_added), and a rebuilt plan replaces them: the item
  // ids are the deck's identity.
  const deck = props.items.map((item) => item.itemId).join(' ')
  const send: RecordOutcome =
    plan === undefined
      ? record
      : (input) => record({ ...input, planId: plan.id, planVersion: plan.version })
  return (
    <CardDeck
      key={deck}
      {...props}
      record={send}
      revealed={revealed}
      onRevealChange={onRevealChange}
    />
  )
}

export { CardBlock }
