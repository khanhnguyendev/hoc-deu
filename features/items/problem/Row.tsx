import { LinkRow } from '@/components/patterns/link-row'
import { vi } from '@/lib/i18n/vi'
import { PremiumBadge } from '../components/difficulty-badge'
import { VerificationBadge } from '../components/verification-badge'
import { rowBadges, rowStatus } from '../status'
import { topicTitleOf } from '../track-info'
import type { ItemRowProps } from '../types'
import { isNoteVisible } from './note'

/**
 * A problem in a list: the English title, "#1 · Easy · Arrays & Hashing", the Premium marker and
 * the verification icon of a published note; status badges and pill as every Row.
 */
export function ProblemRow({ item, state, href, showStatus }: ItemRowProps<'problem'>) {
  const problem = item.content
  const note = isNoteVisible(problem.note, false) ? problem.note : null
  return (
    <LinkRow
      href={href}
      title={problem.title}
      titleLang="en"
      meta={[`#${problem.leetcode}`, vi.items.difficulty[problem.difficulty], topicTitleOf(item)]}
      badges={rowBadges(item.status, [
        problem.premium && <PremiumBadge />,
        note !== null && <VerificationBadge verification={note.verification} variant="icon" />,
      ])}
      trailing={rowStatus(state, showStatus)}
    />
  )
}
