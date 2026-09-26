'use client'

import { Eye, EyeOff, RotateCcw } from 'lucide-react'
import { useId, useMemo, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { fill } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { OutcomeBinding } from '../../outcome'
import { OutcomeSignalsContext, type OutcomeSignals } from '../../outcome-signals'
import { GradeButtons, OutcomeMessage, type GradeOption } from './grade-buttons'
import { useOutcome } from './use-outcome'

const copy = vi.outcomes.problem

type ProblemGrade = 'solved' | 'hint' | 'failed'
/** How the page grades: a new problem, a redo, or a quick recall (explain-aloud included). */
type ProblemMode = 'new' | 'redo' | 'recall'

const GRADE_ORDER: readonly ProblemGrade[] = ['solved', 'hint', 'failed']

function problemMode(mode: OutcomeBinding['mode']): ProblemMode {
  if (mode === 'recall' || mode === 'explain-aloud') return 'recall'
  return mode === 'redo' ? 'redo' : 'new'
}

function gradesFor(mode: ProblemMode): readonly GradeOption<ProblemGrade>[] {
  const labels = mode === 'recall' ? copy.recall : copy.solve
  return GRADE_ORDER.map((value) => ({ value, label: labels[value] }))
}

/**
 * A problem's result (§5.5; decisions 17, 18). `children` is the page's note (or its "Chưa có ghi
 * chú"), which this component places:
 *
 * - **new / redo** — the note, then "Tự giải được" / "Cần gợi ý" / "Chưa giải được" (`solved` /
 *   `hint` / `failed`); a redo sends `mode: 'redo'`, a new problem no mode.
 * - **recall / explain-aloud** — first the prompt "Nêu pattern, cách làm và độ phức tạp" with the
 *   note behind "Xem ghi chú", then "Nhớ rõ" / "Nhớ một phần" / "Không nhớ" with `mode: 'recall'`
 *   (without a visible note the grades show at once); "Làm lại từ đầu" switches to a redo.
 *
 * The nudge: opening the note's "Xem lời giải" (SolutionTabs, through `OutcomeSignalsContext`)
 * before a grade is saved preselects the `hint` grade; any grade can still be chosen. The answer is
 * announced in a polite live region; a failed save leaves every grade available.
 */
function ProblemOutcome({
  binding,
  hasNote,
  children,
}: {
  binding: OutcomeBinding
  /** A visible note to hide behind "Xem ghi chú" in a recall. */
  hasNote: boolean
  children?: ReactNode
}) {
  const [mode, setMode] = useState<ProblemMode>(() => problemMode(binding.mode))
  const [noteOpen, setNoteOpen] = useState(false)
  const [solutionSeen, setSolutionSeen] = useState(false)
  const { pending, sent, saved, send } = useOutcome<ProblemGrade>(binding)
  const noteId = useId()
  const signals = useMemo<OutcomeSignals>(
    () => ({ solutionRevealed: () => setSolutionSeen(true), quizScored: () => {} }),
    [],
  )

  const grades = gradesFor(mode)
  const recall = mode === 'recall'
  const hidden = recall && hasNote && !noteOpen
  const suggested: ProblemGrade | null = saved === null && solutionSeen ? 'hint' : null
  const hintLabel = grades.find((grade) => grade.value === 'hint')?.label ?? ''

  const grade = (value: ProblemGrade) =>
    send(
      mode === 'new'
        ? { type: 'item.result', result: value }
        : { type: 'item.result', result: value, mode },
      value,
    )

  return (
    <OutcomeSignalsContext value={signals}>
      <div data-slot="problem-outcome" className="flex flex-col gap-6">
        {recall && (
          <section
            aria-labelledby={`${noteId}-prompt`}
            className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
          >
            <h2 id={`${noteId}-prompt`} className="text-lg font-semibold">
              {copy.recallPrompt}
            </h2>
            <p className="text-muted-foreground">
              {binding.mode === 'explain-aloud' ? copy.explainAloudBody : copy.recallBody}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {hasNote && (
                <Button
                  variant={noteOpen ? 'outline' : 'primary'}
                  aria-expanded={noteOpen}
                  aria-controls={noteId}
                  onClick={() => setNoteOpen(!noteOpen)}
                >
                  {noteOpen ? (
                    <EyeOff aria-hidden="true" strokeWidth={1.75} />
                  ) : (
                    <Eye aria-hidden="true" strokeWidth={1.75} />
                  )}
                  {noteOpen ? copy.hideNote : copy.showNote}
                </Button>
              )}
              <Button variant="link" onClick={() => setMode('redo')}>
                <RotateCcw aria-hidden="true" strokeWidth={1.75} />
                {copy.redo}
              </Button>
            </div>
          </section>
        )}
        {mode === 'redo' && <p className="text-muted-foreground">{copy.redoBody}</p>}
        <div id={noteId} className="contents">
          {!hidden && children}
        </div>
        {!hidden && (
          <GradeButtons
            label={recall ? copy.recallLabel : copy.solveLabel}
            grades={grades}
            selected={saved ?? suggested}
            pending={pending}
            description={suggested === null ? undefined : fill(copy.nudge, { grade: hintLabel })}
            onGrade={grade}
          />
        )}
        <OutcomeMessage result={sent} />
      </div>
    </OutcomeSignalsContext>
  )
}

export { ProblemOutcome }
