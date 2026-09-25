import { Badge } from '@/components/ui/badge'
import { FlashcardView } from '../components/flashcard-view'
import { ItemPageFrame } from '../components/item-page-frame'
import type { ItemPageProps } from '../types'
import { tierLabel } from './tier'

/**
 * A flashcard (§3.4, §3.5): its tier, then the card — the front is the page's `h1`, in the card's
 * language; "Xem nghĩa" reveals the rest. Grading arrives with task 5.2.
 */
export function FlashcardPage({ item }: ItemPageProps<'flashcard'>) {
  const card = item.content
  return (
    <ItemPageFrame
      status={item.status}
      meta={[
        <Badge key="tier" tone={card.tier === 'core' ? 'primary' : 'neutral'}>
          {tierLabel(card.tier)}
        </Badge>,
      ]}
    >
      <FlashcardView
        card={{
          front: card.front,
          back: card.back,
          hint: card.hint,
          usage: card.usage,
          example: card.example,
          pronunciation: card.pronunciation,
          lang: card.lang,
        }}
        headingLevel={1}
      />
    </ItemPageFrame>
  )
}
