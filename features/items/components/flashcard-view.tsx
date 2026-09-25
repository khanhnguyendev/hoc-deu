'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
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
 * until revealed. Grade buttons arrive with task 5.2.
 */
function FlashcardView({
  card,
  headingLevel = 2,
}: {
  card: FlashcardSides
  /** 1 on the item page (the front is the page title); 2 inside other screens. */
  headingLevel?: 1 | 2 | 3
}) {
  const [open, setOpen] = useState(false)
  const backId = useId()
  const Heading = `h${headingLevel}` as const
  return (
    <Card data-slot="flashcard-view" className="gap-5 md:gap-5">
      <Heading lang={card.lang.front} className="text-2xl font-semibold md:text-3xl">
        {card.front}
      </Heading>
      <Button
        variant={open ? 'outline' : 'primary'}
        aria-expanded={open}
        aria-controls={backId}
        onClick={() => setOpen(!open)}
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
    </Card>
  )
}

export { FlashcardView }
