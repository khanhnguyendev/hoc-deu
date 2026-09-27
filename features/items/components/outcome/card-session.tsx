'use client'

import { CircleCheckBig, Layers } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { EmptyState } from '@/components/patterns/empty-state'
import { ErrorState } from '@/components/patterns/error-state'
import { fill } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { outcomeInput, type CardSessionCard, type CardSessionProps } from '../../outcome'
import { FlashcardView } from '../flashcard-view'
import { fillNode } from '../mdx/copy'
import { FlashcardGrades, type FlashcardGrade } from './flashcard-grades'

const copy = vi.outcomes.session

type Failure = { readonly grade: FlashcardGrade; readonly message: string }
/** What the live region says after a grade: the card and the grade, so every save is new text. */
type Announcement = { readonly card: CardSessionCard; readonly grade: FlashcardGrade }

/**
 * Cards graded where they are listed (decision 19): due cards on /review (5.3), card-only blocks
 * on /today (5.4). The cards are kept in state from mount — a revalidation that drops a graded card
 * from the `cards` prop never shifts the session — and graded one at a time: FlashcardView, then
 * FlashcardGrades (keys 1 / 2 / 3) once revealed. A grade sends `{ requestId, itemId, blockId,
 * outcome }` with the mount's request id and moves to the next card (focus on its "Xem nghĩa"); the
 * remaining count and a polite live region ("Đã lưu thẻ {front}: {grade}.") follow. A failed save keeps the card and shows the
 * error state — "Thử lại" resends the same input (the same event id, decision 16) — and the
 * end state "Đã ôn xong" takes focus after the last card. No cards: an empty state. `headingLevel`
 * (default 2) sets the card front's and every EmptyState's heading level, so a caller nesting this
 * under its own section heading (e.g. /review's "Thẻ", task 5.3) can pass 3 (review round 1, M8).
 */
function CardSession({ cards, requestId, record, headingLevel = 2 }: CardSessionProps) {
  const titleAs = headingLevel === 3 ? 'h3' : 'h2'
  const [deck] = useState<readonly CardSessionCard[]>(() => [...cards])
  const [session] = useState(requestId)
  const [index, setIndex] = useState(0)
  const [grading, setGrading] = useState<FlashcardGrade | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [pending, startTransition] = useTransition()
  const graded = useRef(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const card = deck[index]

  // After a grade (never on mount): focus the next card's "Xem nghĩa", or the end state.
  useEffect(() => {
    if (!graded.current) return
    const next = cardRef.current?.querySelector<HTMLElement>('button[aria-expanded]')
    ;(next ?? endRef.current)?.focus()
  }, [index])

  const grade = (value: FlashcardGrade) => {
    if (card === undefined || pending) return
    setGrading(value)
    setFailure(null)
    startTransition(async () => {
      let failed: Failure | null = null
      try {
        const input = outcomeInput(
          { requestId: session, itemId: card.itemId, blockId: card.blockId },
          { type: 'item.result', result: value },
        )
        const result = await record(input)
        if (!result.ok) failed = { grade: value, message: result.message }
      } catch {
        failed = { grade: value, message: vi.outcomes.failed }
      }
      setGrading(null)
      if (failed !== null) {
        setFailure(failed)
        return
      }
      graded.current = true
      setAnnouncement({ card, grade: value })
      setIndex((current) => current + 1)
    })
  }

  if (deck.length === 0) {
    return <EmptyState icon={Layers} title={copy.emptyTitle} titleAs={titleAs} />
  }

  return (
    <div data-slot="card-session" className="flex w-full flex-col gap-4">
      {card === undefined ? (
        <div ref={endRef} tabIndex={-1} className="w-full rounded-lg">
          <EmptyState
            icon={CircleCheckBig}
            title={copy.doneTitle}
            description={fill(copy.doneBody, { count: deck.length })}
            titleAs={titleAs}
          />
        </div>
      ) : (
        <div ref={cardRef} className="flex flex-col gap-3">
          <p className="text-sm font-medium text-muted-foreground">
            {fill(copy.remaining, { count: deck.length - index })}
          </p>
          <FlashcardView key={card.itemId} card={card.sides} headingLevel={headingLevel}>
            <FlashcardGrades onGrade={grade} pending={pending ? grading : null} />
          </FlashcardView>
          {failure !== null && (
            <ErrorState
              title={copy.errorTitle}
              description={failure.message}
              onRetry={() => grade(failure.grade)}
            />
          )}
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement !== null && (
          <span key={announcement.card.itemId}>
            {fillNode(
              fill(copy.saved, { grade: vi.outcomes.flashcard.grades[announcement.grade] }),
              '{front}',
              <span lang={announcement.card.sides.lang.front}>
                {announcement.card.sides.front}
              </span>,
            )}
          </span>
        )}
      </p>
    </div>
  )
}

export { CardSession }
