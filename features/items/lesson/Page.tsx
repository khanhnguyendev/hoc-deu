import { BookOpen } from 'lucide-react'
import { EmptyState } from '@/components/patterns/empty-state'
import { Badge } from '@/components/ui/badge'
import { vi } from '@/lib/i18n/vi'
import { ItemPageFrame } from '../components/item-page-frame'
import { CONTENT_FLOW } from '../components/mdx/typography'
import { LessonComplete } from '../components/outcome/lesson-complete'
import { RelatedItems, type RelatedItem } from '../components/related-items'
import { mdxComponentsFor } from '../mdx/bind'
import { practiceResolver } from '../practice'
import { topicTitleOf } from '../track-info'
import type { ItemPageProps } from '../types'
import { lessonFormatLabel } from './format'

const copy = vi.items.lesson

/**
 * A lesson (§3.3): the title, its format and topic, the anchor / about / practice problems as
 * related items (through `resolveItem`; an unknown one is skipped), then the MDX body bound to its
 * build-time code, the viewer's language and practice links. With the page's `outcome` (task
 * 5.2c), LessonComplete follows the body: "Hoàn thành bài học", with the Quiz's score.
 */
export function LessonPage({ item, viewer, data, resolveItem, outcome }: ItemPageProps<'lesson'>) {
  const lesson = item.content
  const refs: [label: string, id: string | undefined][] = [
    [copy.anchor, lesson.anchor],
    [copy.about, lesson.about],
    [copy.practice, lesson.practice],
  ]
  const related: RelatedItem[] = refs.flatMap(([label, id]) => {
    const link = id === undefined ? null : resolveItem(id)
    return link === null ? [] : [{ label, link }]
  })
  const { Body } = data
  const body =
    Body === null ? (
      <EmptyState icon={BookOpen} title={copy.noBody} />
    ) : (
      <div data-slot="lesson-body" className={CONTENT_FLOW}>
        <Body
          components={mdxComponentsFor({
            code: data.code,
            codeLanguage: viewer.codeLanguage,
            resolvePractice: practiceResolver(resolveItem),
          })}
        />
      </div>
    )

  return (
    <ItemPageFrame
      status={item.status}
      outcome={outcome}
      title={item.title}
      meta={[
        <Badge key="format" tone="primary">
          {lessonFormatLabel(lesson.format)}
        </Badge>,
        topicTitleOf(item),
      ]}
    >
      <RelatedItems items={related} />
      {outcome === undefined ? body : <LessonComplete binding={outcome}>{body}</LessonComplete>}
    </ItemPageFrame>
  )
}
