'use client'

import { CircleCheck, CircleDot, CircleX, Lightbulb } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BLANK, gradeFillBlank } from '@/lib/content/item-types/exercise'
import { vi } from '@/lib/i18n/vi'
import { cn } from '@/lib/utils'
import { fillNode } from './mdx/copy'

const copy = vi.items.exercise

type Grade = ReturnType<typeof gradeFillBlank>

const VERDICT = {
  pass: { icon: CircleCheck, className: 'text-success' },
  close: { icon: CircleDot, className: 'text-warning' },
  miss: { icon: CircleX, className: 'text-danger' },
} as const

/**
 * A fill-blank exercise (§3.5): the English text with its blank as a labelled input. "Kiểm tra"
 * grades it with `gradeFillBlank` — "Chính xác", "Gần đúng — bạn đã xem gợi ý" after the hint, or
 * "Chưa đúng — đáp án: …" — as icon + text in a polite live region; editing the answer clears the
 * verdict. "Xem gợi ý" reveals the hint. Nothing is recorded until task 5.2.
 */
function FillBlankExercise({
  text,
  answers,
  hint,
}: {
  text: string
  answers: readonly string[]
  hint?: string
}) {
  const [value, setValue] = useState('')
  const [hintOpen, setHintOpen] = useState(false)
  const [hintSeen, setHintSeen] = useState(false)
  const [grade, setGrade] = useState<Grade | null>(null)
  const hintId = useId()
  const inputId = useId()
  const at = text.indexOf(BLANK)
  const before = at === -1 ? text : text.slice(0, at)
  const after = at === -1 ? '' : text.slice(at + BLANK.length)

  const check = (event: FormEvent) => {
    event.preventDefault()
    setGrade(gradeFillBlank(value, answers, hintSeen))
  }
  const toggleHint = () => {
    setHintSeen(true)
    setHintOpen(!hintOpen)
  }

  const verdict = grade === null ? null : VERDICT[grade]
  const Icon = verdict?.icon
  return (
    <form data-slot="fill-blank-exercise" onSubmit={check} className="flex flex-col gap-4">
      <p data-slot="fill-blank-text" lang="en" className="text-lg leading-loose">
        {before}
        {/* The text is English; its label is Vietnamese, so it carries its own language. */}
        <label htmlFor={inputId} lang="vi" className="sr-only">
          {copy.blank}
        </label>
        <Input
          id={inputId}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setGrade(null)
          }}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="mx-1 inline-block w-40 align-baseline"
        />
        {after}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">{copy.check}</Button>
        {hint !== undefined && (
          <Button
            type="button"
            variant="outline"
            aria-expanded={hintOpen}
            aria-controls={hintId}
            onClick={toggleHint}
          >
            <Lightbulb aria-hidden="true" strokeWidth={1.75} />
            {hintOpen ? copy.hideHint : copy.showHint}
          </Button>
        )}
      </div>
      {hint !== undefined && (
        <div id={hintId}>
          {hintOpen && <p className="rounded-md bg-surface-muted px-3 py-2 text-sm">{hint}</p>}
        </div>
      )}
      <p
        role="status"
        aria-live="polite"
        className={cn('flex items-start gap-2 font-medium', verdict?.className)}
      >
        {Icon && <Icon aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />}
        {grade === 'pass' && copy.pass}
        {grade === 'close' && copy.close}
        {grade === 'miss' && (
          <span>{fillNode(copy.miss, '{answer}', <span lang="en">{answers[0]}</span>)}</span>
        )}
      </p>
    </form>
  )
}

export { FillBlankExercise }
