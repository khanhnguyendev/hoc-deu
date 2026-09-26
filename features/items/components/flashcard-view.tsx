'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useId, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { FlashcardContent } from '@/lib/content/catalog-types'
import { vi } from '@/lib/i18n/vi'
import { own } from './mdx/copy'

const copy = vi.items.flashcard

/** What the card shows: plain, serialisable data (it crosses to this client component). */
export type FlashcardSides = Pick<
  FlashcardContent,
  'front' | 'back' | 'hint' | 'usage' | 'example' | 'pronunciation' | 'lang'
>

/** "danh từ · trung tính": keyed copy read with `Object.hasOwn`, the raw value otherwise. */
function usageLabel(usage: NonNullable<FlashcardSides['usage']>): string {
  const pos = own<string>(copy.pos, usage.pos) ?? usage.pos
  const register = own<string>(copy.register, usage.register) ?? usage.register
  return `${pos} · ${register}`
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="flex flex-col gap-1">{children}</dd>
    </div>
  )
}

/**
 * A flashcard (DESIGN_SYSTEM §9 FlashcardViewer): the front as a heading in its language, then
 * "Xem nghĩa" reveals the back, hint, usage ("danh từ · trung tính" + note), a work example
 * (`lang="en"`) and the pronunciation. The card stays in place; nothing of the back is in the DOM
 * until revealed. `children` — the three grade buttons (task 5.2c: FlashcardOutcome on the card's
 * page, FlashcardGrades in a CardSession) — show at the bottom of the card from the first reveal
 * on and stay when the back is hidden again; `onReveal` fires on the first reveal only. The card
 * takes focus (`tabIndex={-1}`: a click inside keeps focus in it, and the first reveal focuses it
 * when focus is elsewhere), so the grades' keys reach the card the learner is using.
 */
function FlashcardView({
  card,
  headingLevel = 2,
  onReveal,
  children,
}: {
  card: FlashcardSides
  /** 1 on the item page (the front is the page title); 2 inside other screens. */
  headingLevel?: 1 | 2 | 3
  onReveal?: () => void
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(false)
  const backId = useId()
  const cardRef = useRef<HTMLDivElement>(null)
  const Heading = `h${headingLevel}` as const
  const toggle = () => {
    if (!open && !seen) {
      setSeen(true)
      onReveal?.()
      // Keys (the grades' 1 / 2 / 3) go to the card the learner is looking at: Safari and
      // Firefox on macOS do not focus a clicked button, so focus lands here instead.
      const active = document.activeElement
      if (!(active instanceof Node && cardRef.current?.contains(active))) cardRef.current?.focus()
    }
    setOpen(!open)
  }
  return (
    <Card ref={cardRef} tabIndex={-1} data-slot="flashcard-view" className="gap-5 md:gap-5">
      <Heading lang={card.lang.front} className="text-2xl font-semibold md:text-3xl">
        {card.front}
      </Heading>
      <Button
        variant={open ? 'outline' : 'primary'}
        aria-expanded={open}
        aria-controls={backId}
        onClick={toggle}
        className="self-start"
      >
        {open ? (
          <EyeOff aria-hidden="true" strokeWidth={1.75} />
        ) : (
          <Eye aria-hidden="true" strokeWidth={1.75} />
        )}
        {open ? copy.hide : copy.reveal}
      </Button>
      <div id={backId}>
        {open && (
          <div className="flex flex-col gap-4 border-t border-border pt-4">
            <p lang={card.lang.back} className="text-lg font-medium">
              {card.back}
            </p>
            <dl className="flex flex-col gap-3">
              {card.hint !== undefined && (
                <Field label={copy.hint}>
                  <p lang={card.lang.hint}>{card.hint}</p>
                </Field>
              )}
              {card.usage !== undefined && (
                <Field label={copy.usage}>
                  <p>{usageLabel(card.usage)}</p>
                  {card.usage.note !== undefined && (
                    <p className="text-sm text-muted-foreground">{card.usage.note}</p>
                  )}
                </Field>
              )}
              {card.example !== undefined && (
                <Field label={copy.example}>
                  <p lang="en" className="italic">
                    {card.example}
                  </p>
                </Field>
              )}
              {card.pronunciation !== undefined && (
                <Field label={copy.pronunciation}>
                  <p lang="en" className="font-mono text-sm">
                    {card.pronunciation}
                  </p>
                </Field>
              )}
            </dl>
          </div>
        )}
      </div>
      {seen && children !== undefined && children !== null && (
        <div data-slot="flashcard-actions" className="border-t border-border pt-4">
          {children}
        </div>
      )}
    </Card>
  )
}

export { FlashcardView }
