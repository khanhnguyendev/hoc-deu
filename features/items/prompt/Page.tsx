import { Badge } from '@/components/ui/badge'
import { promptType } from '@/lib/content/item-types/prompt'
import { formatMinutes } from '@/lib/i18n/format'
import { ItemPageFrame } from '../components/item-page-frame'
import { RubricList } from '../components/rubric-list'
import { minutesOf } from '../track-info'
import type { ItemPageProps } from '../types'
import { promptTagLabel } from './tag'

/**
 * A prompt (§3.5): the Vietnamese instruction as the `h1`, the English one in `lang="en"`, its tag
 * and minutes (its own, else the manifest's estimate), and the rubric in its language
 * (`lang.rubric`, M3-R5). Completion is recorded from task 5.2.
 */
export function PromptPage({ item, context }: ItemPageProps<'prompt'>) {
  const prompt = item.content
  // The same minutes as the Row for the same mode (`context.mode`, as `PromptRow`'s `mode`).
  const minutes = minutesOf(promptType, item, context.mode) ?? prompt.minutes ?? null
  return (
    <ItemPageFrame
      status={item.status}
      title={prompt.instruction.vi}
      description={<span lang="en">{prompt.instruction.en}</span>}
      meta={[
        <Badge key="tag" tone="primary">
          {promptTagLabel(prompt.tag)}
        </Badge>,
        minutes === null ? null : formatMinutes(minutes),
      ]}
    >
      <RubricList items={prompt.rubric} lang={prompt.lang.rubric} />
    </ItemPageFrame>
  )
}
