import { NotebookPen } from 'lucide-react'
import { LinkRow } from '@/components/patterns/link-row'
import { vi } from '@/lib/i18n/vi'
import { PremiumBadge } from '../components/difficulty-badge'
import { VerificationBadge } from '../components/verification-badge'
import { rowBadges, rowStatus } from '../status'
import { topicTitleOf } from '../track-info'
import type { ItemRowProps } from '../types'
import { isNoteVisible } from './note'

/** "Chưa có ghi chú" in a row (§5.9, RF-4): the LeetCode link is enough to study the problem. */
function NoteHint() {
  return (
    <span data-slot="note-hint" className="inline-flex items-center gap-1.5">
      <NotebookPen aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
      {vi.items.problem.noNote}
    </span>
  )
}

/**
 * A problem in a list: the English title, "#1 · Easy · Arrays & Hashing", the Premium marker and
 * the verification icon of a published note; status badges and pill as every Row. With
 * `showNoteHint` (ruling M5-R26), a problem whose note a learner cannot see — none yet, or a
 * draft — says "Chưa có ghi chú" in the row.
 */
export function ProblemRow({
  item,
  state,
  href,
  showStatus,
  showNoteHint = false,
}: ItemRowProps<'problem'>) {
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
        showNoteHint && note === null && <NoteHint />,
      ])}
      trailing={rowStatus(state, showStatus)}
    />
  )
}
