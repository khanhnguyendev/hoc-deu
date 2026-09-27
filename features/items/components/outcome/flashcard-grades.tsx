'use client'

import { useEffect, useEffectEvent, useRef } from 'react'
import { vi } from '@/lib/i18n/vi'
import type { OutcomeBinding } from '../../outcome'
import { GradeButtons, OutcomeMessage, type GradeOption } from './grade-buttons'
import { useOutcome } from './use-outcome'

const copy = vi.outcomes.flashcard

export type FlashcardGrade = 'know' | 'unsure' | 'dont_know'

const GRADES: readonly GradeOption<FlashcardGrade>[] = [
  { value: 'know', label: copy.grades.know, shortcut: '1' },
  { value: 'unsure', label: copy.grades.unsure, shortcut: '2' },
  { value: 'dont_know', label: copy.grades.dont_know, shortcut: '3' },
]

const BY_KEY: Readonly<Record<string, FlashcardGrade>> = { 1: 'know', 2: 'unsure', 3: 'dont_know' }

/** Typing somewhere: the keys belong to the field, not to the grades. */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

/**
 * A card's three grades (DESIGN_SYSTEM §9 FlashcardViewer): "Biết" / "Chưa chắc" / "Không biết"
 * (`know` / `unsure` / `dont_know`), also on the keys 1 / 2 / 3 — while nothing saves, without a
 * modifier, not while typing or composing, and only for keys pressed inside this card (the
 * listener sits on the card, which keeps focus — FlashcardView — so two cards on one screen never
 * both take a key, and a key on the page outside any card grades none). Presentational: the caller
 * records the grade
 * (FlashcardOutcome on the card's page, CardSession on /review and /today).
 */
function FlashcardGrades({
  onGrade,
  selected = null,
  pending = null,
  disabled = false,
}: {
  onGrade: (grade: FlashcardGrade) => void
  selected?: FlashcardGrade | null
  pending?: FlashcardGrade | null
  disabled?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const gradeByKey = useEffectEvent((grade: FlashcardGrade) => onGrade(grade))

  const listening = !disabled && pending === null
  useEffect(() => {
    // Keys pressed inside this card only (its FlashcardView, else these buttons): with two cards
    // on one screen, a key grades the one the learner is in — never the other, never both.
    const card = ref.current?.closest<HTMLElement>('[data-slot="flashcard-view"]') ?? ref.current
    if (!listening || card === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (!Object.hasOwn(BY_KEY, event.key) || isEditable(event.target)) return
      event.preventDefault()
      gradeByKey(BY_KEY[event.key]!)
    }
    card.addEventListener('keydown', onKeyDown)
    return () => card.removeEventListener('keydown', onKeyDown)
  }, [listening])

  return (
    <div ref={ref} data-slot="flashcard-grades">
      <GradeButtons
        label={copy.label}
        grades={GRADES}
        selected={selected}
        pending={pending}
        disabled={disabled}
        description={copy.keys}
        onGrade={onGrade}
      />
    </div>
  )
}

/**
 * The flashcard page's grading (FlashcardPage, inside FlashcardView once revealed): FlashcardGrades
 * bound to the page's outcome — `item.result { result }` with the render's request id and block —
 * the saved grade pressed, and the answer in a polite live region.
 */
function FlashcardOutcome({ binding }: { binding: OutcomeBinding }) {
  const { pending, sent, saved, send } = useOutcome<FlashcardGrade>(binding)
  return (
    <div data-slot="flashcard-outcome" className="flex flex-col gap-3">
      <FlashcardGrades
        selected={saved}
        pending={pending}
        onGrade={(grade) => send({ type: 'item.result', result: grade }, grade)}
      />
      <OutcomeMessage result={sent} label={sent === null ? undefined : copy.grades[sent.key]} />
    </div>
  )
}

export { FlashcardGrades, FlashcardOutcome }
