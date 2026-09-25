import { LinkRow } from '@/components/patterns/link-row'
import { rowBadges, rowStatus } from '../status'
import type { ItemRowProps } from '../types'
import { exerciseKindLabel } from './kind'

/** An exercise in a list: its Vietnamese instruction and its kind. */
export function ExerciseRow({ item, state, href, showStatus }: ItemRowProps<'exercise'>) {
  return (
    <LinkRow
      href={href}
      title={item.content.instruction.vi}
      meta={[exerciseKindLabel(item.content.kind)]}
      badges={rowBadges(item.status)}
      trailing={rowStatus(state, showStatus)}
    />
  )
}
