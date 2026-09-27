import { NotebookPen } from 'lucide-react'
import { EmptyState } from '@/components/patterns/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { vi } from '@/lib/i18n/vi'
import { DifficultyBadge, PremiumBadge } from '../components/difficulty-badge'
import { ItemPageFrame } from '../components/item-page-frame'
import { ItemStatusBadge } from '../components/item-status-badge'
import { ExternalLink } from '../components/mdx/external-link'
import { CONTENT_FLOW } from '../components/mdx/typography'
import { ProblemOutcome } from '../components/outcome/problem-outcome'
import { RelatedItems } from '../components/related-items'
import { VerificationBadge } from '../components/verification-badge'
import { mdxComponentsFor } from '../mdx/bind'
import { practiceResolver } from '../practice'
import { topicTitleOf } from '../track-info'
import type { ItemPageProps } from '../types'
import { isNoteVisible } from './note'

const copy = vi.items.problem

/** A link that leaves the app as a 44 px button (ExternalLink: https only, new tab, said so). */
const outbound = (variant: 'outline' | 'link') => buttonVariants({ variant, size: 'md' })

/**
 * A problem (§3.5): `#leetcode`, the English title, difficulty, topic, "Mở trên LeetCode"; a
 * premium problem's free alternatives; the note (bound to its build-time code, the viewer's
 * language and `resolveItem`) with its verification badge, or "Chưa có ghi chú" — a draft note
 * shows only to admins, marked "Bản nháp"; the deep-dive lesson when there is one. With the
 * page's `outcome` (task 5.2c), ProblemOutcome places the note and grades the problem — new,
 * redo, or a quick recall with the note behind "Xem ghi chú" — and the frame shows the learner's
 * status and the item actions; without one it is read-only.
 */
export function ProblemPage({
  item,
  viewer,
  data,
  resolveItem,
  outcome,
}: ItemPageProps<'problem'>) {
  const problem = item.content
  const note = isNoteVisible(problem.note, viewer.isAdmin) ? problem.note : null
  const Body = note === null ? null : data.Body
  const deepDive = note?.deepDiveId ? resolveItem(note.deepDiveId) : null
  const components =
    Body === null
      ? null
      : mdxComponentsFor({
          code: data.code,
          codeLanguage: viewer.codeLanguage,
          resolvePractice: practiceResolver(resolveItem),
        })

  const noteSection =
    note !== null && Body !== null && components !== null ? (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <ItemStatusBadge status={note.status} />
          <VerificationBadge verification={note.verification} />
        </div>
        <div data-slot="problem-note" className={CONTENT_FLOW}>
          <Body components={components} />
        </div>
      </div>
    ) : (
      <EmptyState icon={NotebookPen} title={copy.noNote} description={copy.noNoteBody} />
    )

  return (
    <ItemPageFrame
      status={item.status}
      outcome={outcome}
      title={<span lang="en">{problem.title}</span>}
      actions={
        <ExternalLink href={problem.url} className={outbound('outline')}>
          {copy.openOnLeetCode}
        </ExternalLink>
      }
      meta={[
        <span key="number" className="font-mono">
          #{problem.leetcode}
        </span>,
        <DifficultyBadge key="difficulty" difficulty={problem.difficulty} />,
        topicTitleOf(item),
        problem.premium ? <PremiumBadge key="premium" /> : null,
      ]}
    >
      {problem.premium && problem.alternatives.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-0">
          <span className="text-sm font-medium">{copy.freeAlternatives}</span>
          {problem.alternatives.map((alternative) => (
            <ExternalLink key={alternative.url} href={alternative.url} className={outbound('link')}>
              {alternative.label}
            </ExternalLink>
          ))}
        </div>
      )}
      {outcome === undefined ? (
        noteSection
      ) : (
        <ProblemOutcome binding={outcome} hasNote={components !== null}>
          {noteSection}
        </ProblemOutcome>
      )}
      {deepDive !== null && <RelatedItems items={[{ label: copy.deepDive, link: deepDive }]} />}
    </ItemPageFrame>
  )
}
