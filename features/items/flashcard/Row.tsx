import { LinkRow } from '@/components/patterns/link-row'
import { rowBadges, rowStatus } from '../status'
import type { ItemRowProps } from '../types'
import { tierLabel } from './tier'

/** A card in a list: its front, in the card's language, and its tier. */
export function FlashcardRow({ item, state, href, showStatus }: ItemRowProps<'flashcard'>) {
  const card = item.content
  return (
    <LinkRow
      href={href}
      title={card.front}
      titleLang={card.lang.front}
      meta={[tierLabel(card.tier)]}
      badges={rowBadges(item.status)}
      trailing={rowStatus(state, showStatus)}
    />
  )
}
