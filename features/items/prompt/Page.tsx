import { Code } from 'lucide-react'
import { EmptyState } from '@/components/patterns/empty-state'
import { Badge } from '@/components/ui/badge'
import { promptType } from '@/lib/content/item-types/prompt'
import { formatMinutes } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { ItemPageFrame } from '../components/item-page-frame'
import { PromptOutcome } from '../components/outcome/prompt-outcome'
import { RelatedItems } from '../components/related-items'
import { RubricList } from '../components/rubric-list'
import { minutesOf } from '../track-info'
import type { ItemPageProps } from '../types'
import { promptTagLabel } from './tag'

const copy = vi.outcomes.mockInterview

/**
 * A prompt (§3.5): the Vietnamese instruction as the `h1`, the English one in `lang="en"`, its tag
 * and minutes (its own, else the manifest's estimate), and the rubric in its language
 * (`lang.rubric`, M3-R5). The mock-interview prompt also shows the problem `mockInterviewProblem`
 * picks (§5.6; M4 decision 24) — a link, or "Chưa có bài Medium nào đã học". With the page's
 * `outcome` (task 5.2c) PromptOutcome records it: "Đã làm xong" with an optional 1–3 self-rating.
 */
export function PromptPage({ item, outcome, mockInterviewProblem }: ItemPageProps<'prompt'>) {
  const prompt = item.content
  // The same minutes as the Row for the same mode (the binding's mode, as `PromptRow`'s `mode`).
  const minutes = minutesOf(promptType, item, outcome?.mode) ?? prompt.minutes ?? null
  return (
    <ItemPageFrame
      status={item.status}
      outcome={outcome}
      title={prompt.instruction.vi}
      description={<span lang="en">{prompt.instruction.en}</span>}
      meta={[
        <Badge key="tag" tone="primary">
          {promptTagLabel(prompt.tag)}
        </Badge>,
        minutes === null ? null : formatMinutes(minutes),
      ]}
    >
      {mockInterviewProblem === null && (
        <EmptyState icon={Code} title={copy.none} description={copy.noneBody} />
      )}
      {mockInterviewProblem !== undefined && mockInterviewProblem !== null && (
        <RelatedItems items={[{ label: copy.pick, link: mockInterviewProblem }]} />
      )}
      <RubricList items={prompt.rubric} lang={prompt.lang.rubric} />
      {outcome && <PromptOutcome binding={outcome} />}
    </ItemPageFrame>
  )
}
