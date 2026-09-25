import { ExternalLink as ExternalLinkIcon, NotebookPen } from 'lucide-react'
import type * as React from 'react'
import { EmptyState } from '@/components/patterns/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { vi } from '@/lib/i18n/vi'
import { DifficultyBadge, PremiumBadge } from '../components/difficulty-badge'
import { ItemPageFrame } from '../components/item-page-frame'
import { ItemStatusBadge } from '../components/item-status-badge'
import { CONTENT_FLOW } from '../components/mdx/typography'
import { RelatedItems } from '../components/related-items'
import { VerificationBadge } from '../components/verification-badge'
import { mdxComponentsFor } from '../mdx/bind'
import { practiceResolver } from '../practice'
import { topicTitleOf } from '../track-info'
import type { ItemPageProps } from '../types'
import { isNoteVisible } from './note'

const copy = vi.items.problem

/** A link that leaves the app: a new tab, safely, saying so to screen readers; 44 px tall. */
function OutboundLink({
  href,
  variant,
  children,
}: {
  href: string
  variant: 'outline' | 'link'
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonVariants({ variant, size: 'md' })}
    >
      {children}
      <ExternalLinkIcon aria-hidden="true" strokeWidth={1.75} />
      <span className="sr-only">{vi.content.newTab}</span>
    </a>
  )
}

/**
 * A problem (§3.5): `#leetcode`, the English title, difficulty, topic, "Mở trên LeetCode"; a
 * premium problem's free alternatives; the note (bound to its build-time code, the viewer's
 * language and `resolveItem`) with its verification badge, or "Chưa có ghi chú" — a draft note
 * shows only to admins, marked "Bản nháp"; the deep-dive lesson when there is one. Read-only
 * until task 5.2 records results.
 */
export function ProblemPage({ item, viewer, data, resolveItem }: ItemPageProps<'problem'>) {
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

  return (
    <ItemPageFrame
      status={item.status}
      title={<span lang="en">{problem.title}</span>}
      actions={
        <OutboundLink href={problem.url} variant="outline">
          {copy.openOnLeetCode}
        </OutboundLink>
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
            <OutboundLink key={alternative.url} href={alternative.url} variant="link">
              {alternative.label}
            </OutboundLink>
          ))}
        </div>
      )}
      {note !== null && Body !== null && components !== null ? (
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
      )}
      {deepDive !== null && <RelatedItems items={[{ label: copy.deepDive, link: deepDive }]} />}
    </ItemPageFrame>
  )
}
