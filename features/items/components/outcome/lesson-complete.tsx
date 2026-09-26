'use client'

import { CircleCheck } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { fill } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { OutcomeBinding } from '../../outcome'
import { OutcomeSignalsContext, type OutcomeSignals } from '../../outcome-signals'
import { OutcomeMessage } from './grade-buttons'
import { useOutcome } from './use-outcome'

const copy = vi.outcomes.lesson

/**
 * A lesson's result (§4.4): the lesson body (`children`), then "Hoàn thành bài học" — the view's
 * one primary action — sending `lesson.completed`, with `quizScore` (0–100) once the lesson's Quiz
 * was checked: the Quiz reports its score through `OutcomeSignalsContext`, and the latest check
 * counts ("Kèm điểm kiểm tra nhanh: 50%"). The answer is announced in a polite live region.
 */
function LessonComplete({ binding, children }: { binding: OutcomeBinding; children?: ReactNode }) {
  const [quizScore, setQuizScore] = useState<number | null>(null)
  const { pending, sent, saved, send } = useOutcome<'completed'>(binding)
  const signals = useMemo<OutcomeSignals>(
    () => ({ solutionRevealed: () => {}, quizScored: setQuizScore }),
    [],
  )

  const complete = () =>
    send(
      quizScore === null ? { type: 'lesson.completed' } : { type: 'lesson.completed', quizScore },
      'completed',
    )

  return (
    <OutcomeSignalsContext value={signals}>
      {children}
      <div
        data-slot="lesson-complete"
        className="flex flex-col items-start gap-3 border-t border-border pt-6"
      >
        <Button size="lg" loading={pending !== null} onClick={complete}>
          {saved !== null && <CircleCheck aria-hidden="true" strokeWidth={1.75} />}
          {copy.complete}
        </Button>
        {quizScore !== null && (
          <p className="text-sm text-muted-foreground">
            {fill(copy.quizScore, { percent: quizScore })}
          </p>
        )}
        <OutcomeMessage result={sent} />
      </div>
    </OutcomeSignalsContext>
  )
}

export { LessonComplete }
