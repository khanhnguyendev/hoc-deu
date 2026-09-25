'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { vi } from '@/lib/i18n/vi'
import { RubricList } from './rubric-list'

const copy = vi.items.exercise

/**
 * A respond / rewrite exercise (§3.5): the English text, a labelled answer box ("Câu trả lời
 * không được lưu." — nothing is stored), and "Xem câu trả lời mẫu" revealing the sample answers
 * (`lang="en"`) and the rubric. Self-grading ("Đạt / Gần đạt / Chưa đạt") arrives with task 5.2.
 */
function SelfGradedExercise({
  text,
  sampleAnswers,
  rubric,
}: {
  text: string
  sampleAnswers: readonly string[]
  rubric: readonly string[]
}) {
  const [open, setOpen] = useState(false)
  const answerId = useId()
  const helperId = useId()
  const samplesId = useId()
  const samplesHeadingId = useId()
  return (
    <div data-slot="self-graded-exercise" className="flex flex-col gap-4">
      <blockquote
        data-slot="exercise-text"
        lang="en"
        className="border-l-4 border-border-strong pl-4 text-lg"
      >
        {text}
      </blockquote>
      <div className="flex flex-col gap-2">
        <Label htmlFor={answerId}>{copy.answer}</Label>
        <Textarea id={answerId} lang="en" aria-describedby={helperId} />
        <p id={helperId} className="text-sm text-muted-foreground">
          {copy.notSaved}
        </p>
      </div>
      <Button
        variant="outline"
        aria-expanded={open}
        aria-controls={samplesId}
        onClick={() => setOpen(!open)}
        className="self-start"
      >
        {open ? (
          <EyeOff aria-hidden="true" strokeWidth={1.75} />
        ) : (
          <Eye aria-hidden="true" strokeWidth={1.75} />
        )}
        {open ? copy.hideSamples : copy.showSamples}
      </Button>
      <div id={samplesId}>
        {open && (
          <div className="flex flex-col gap-4 rounded-lg bg-surface-muted p-4">
            <div className="flex flex-col gap-2">
              <h2 id={samplesHeadingId} className="text-base font-semibold">
                {copy.samples}
              </h2>
              <ul role="list" aria-labelledby={samplesHeadingId} className="flex flex-col gap-2">
                {sampleAnswers.map((answer, index) => (
                  // Sample answers are an ordered list and may repeat: position is their identity.
                  <li key={index} lang="en">
                    {answer}
                  </li>
                ))}
              </ul>
            </div>
            <RubricList items={rubric} lang="en" />
          </div>
        )}
      </div>
    </div>
  )
}

export { SelfGradedExercise }
