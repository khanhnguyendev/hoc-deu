/**
 * `/today`'s blocks as ReactNode slots (the roadmap's fix-5 pattern): the page renders each item's
 * row through the registry (`todaySlots`, server-only) and hands the slots to TodayView, so the
 * components here never import the registry and render in the client catalog with plain nodes.
 * Types only.
 */
import type * as React from 'react'
import type { CardSessionCard } from '@/features/items/outcome'

/** One item of a block: its registry row (with its own note hint, ruling M5-R26). */
export type BlockItemSlot = {
  readonly itemId: string
  readonly row: React.ReactNode
}

/** A shadowing card's example sentence (§5.6), English learning content. */
export type ShadowingSentence = { readonly itemId: string; readonly text: string }

export type BlockSlots = {
  readonly items: readonly BlockItemSlot[]
  readonly sentences: readonly ShadowingSentence[]
  /** A card-only block (decision 19): the cards its CardSession grades — those not handled yet;
   *  null for any other block. */
  readonly cards: readonly CardSessionCard[] | null
}

/** Keyed by block ID. */
export type TodaySlots = Readonly<Record<string, BlockSlots>>

export const EMPTY_BLOCK_SLOTS: BlockSlots = { items: [], sentences: [], cards: null }
