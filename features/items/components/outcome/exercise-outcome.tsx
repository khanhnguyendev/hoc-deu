'use client'

import type { Exercise } from '@/lib/content/item-types/exercise'
import type { OutcomeBinding } from '../../outcome'
import { FillBlankExercise, type FillBlankGrade } from '../fill-blank-exercise'
import { SelfGradedExercise, type SelfGrade } from '../self-graded-exercise'
import { OutcomeMessage } from './grade-buttons'
import { useOutcome } from './use-outcome'

/**
 * An exercise and its submission (§3.5, §4.4): a fill-blank (FillBlankExercise) or a respond /
 * rewrite (SelfGradedExercise, the rubric in `lang.rubric`). With a binding, every check's grade
 * (`pass` / `close` / `miss`) — or the learner's own grade against the rubric — is sent as
 * `exercise.submitted { kind, grade }` and answered in a polite live region; the answer text is
 * never sent. Without one (a draft an admin previews, a retired item) it is the exercise alone.
 */
function ExerciseOutcome({ exercise, binding }: { exercise: Exercise; binding?: OutcomeBinding }) {
  const { pending, sent, saved, send } = useOutcome<FillBlankGrade | SelfGrade>(
    binding ?? NO_BINDING,
  )
  const submit =
    binding === undefined
      ? undefined
      : (grade: FillBlankGrade | SelfGrade) =>
          send({ type: 'exercise.submitted', kind: exercise.kind, grade }, grade)

  return (
    <div data-slot="exercise-outcome" className="flex flex-col gap-4">
      {exercise.kind === 'fill-blank' ? (
        <FillBlankExercise
          text={exercise.text}
          answers={exercise.answers}
          hint={exercise.hint}
          onGrade={submit}
        />
      ) : (
        <SelfGradedExercise
          text={exercise.text}
          sampleAnswers={exercise.sampleAnswers}
          rubric={exercise.rubric}
          rubricLang={exercise.lang.rubric}
          onGrade={submit}
          selectedGrade={saved}
          pendingGrade={pending}
        />
      )}
      {binding !== undefined && <OutcomeMessage result={sent} />}
    </div>
  )
}

/** A read-only page's stand-in (never called: `submit` is undefined without a binding). */
const NO_BINDING: Pick<OutcomeBinding, 'requestId' | 'itemId' | 'record'> = {
  requestId: '',
  itemId: '',
  record: () => Promise.reject(new Error('read-only')),
}

export { ExerciseOutcome }
