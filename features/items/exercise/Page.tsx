import { Badge } from '@/components/ui/badge'
import { ItemPageFrame } from '../components/item-page-frame'
import { ExerciseOutcome } from '../components/outcome/exercise-outcome'
import type { ItemPageProps } from '../types'
import { exerciseKindLabel } from './kind'

/**
 * An exercise (§3.5): the Vietnamese instruction as the `h1`, the English one in `lang="en"`, its
 * kind; then a fill-blank (auto-graded, `gradeFillBlank`) or a respond / rewrite answer box with
 * sample answers and rubric (ExerciseOutcome). With the page's `outcome` (task 5.2c) every check's
 * grade — or the learner's own grade against the rubric — is submitted; without one it is read-only.
 */
export function ExercisePage({ item, outcome }: ItemPageProps<'exercise'>) {
  const exercise = item.content
  return (
    <ItemPageFrame
      status={item.status}
      outcome={outcome}
      title={exercise.instruction.vi}
      description={<span lang="en">{exercise.instruction.en}</span>}
      meta={[
        <Badge key="kind" tone="primary">
          {exerciseKindLabel(exercise.kind)}
        </Badge>,
      ]}
    >
      <ExerciseOutcome exercise={exercise} binding={outcome} />
    </ItemPageFrame>
  )
}
