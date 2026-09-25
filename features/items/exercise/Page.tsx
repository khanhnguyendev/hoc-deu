import { Badge } from '@/components/ui/badge'
import { FillBlankExercise } from '../components/fill-blank-exercise'
import { ItemPageFrame } from '../components/item-page-frame'
import { SelfGradedExercise } from '../components/self-graded-exercise'
import type { ItemPageProps } from '../types'
import { exerciseKindLabel } from './kind'

/**
 * An exercise (§3.5): the Vietnamese instruction as the `h1`, the English one in `lang="en"`, its
 * kind; then a fill-blank (auto-graded, `gradeFillBlank`) or a respond / rewrite answer box with
 * sample answers and rubric. Nothing is recorded until task 5.2.
 */
export function ExercisePage({ item }: ItemPageProps<'exercise'>) {
  const exercise = item.content
  return (
    <ItemPageFrame
      status={item.status}
      title={exercise.instruction.vi}
      description={<span lang="en">{exercise.instruction.en}</span>}
      meta={[
        <Badge key="kind" tone="primary">
          {exerciseKindLabel(exercise.kind)}
        </Badge>,
      ]}
    >
      {exercise.kind === 'fill-blank' ? (
        <FillBlankExercise text={exercise.text} answers={exercise.answers} hint={exercise.hint} />
      ) : (
        <SelfGradedExercise
          text={exercise.text}
          sampleAnswers={exercise.sampleAnswers}
          rubric={exercise.rubric}
          rubricLang={exercise.lang.rubric}
        />
      )}
    </ItemPageFrame>
  )
}
