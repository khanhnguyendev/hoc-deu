import { LinkRow } from '@/components/patterns/link-row'
import { promptType } from '@/lib/content/item-types/prompt'
import { formatMinutes } from '@/lib/i18n/format'
import { rowBadges, rowStatus } from '../status'
import { minutesOf } from '../track-info'
import type { ItemRowProps } from '../types'
import { promptTagLabel } from './tag'

/** A prompt in a list: its Vietnamese instruction and "tag · minutes". */
export function PromptRow({ item, state, mode, href, showStatus }: ItemRowProps<'prompt'>) {
  const prompt = item.content
  const minutes = minutesOf(promptType, item, mode) ?? prompt.minutes ?? null
  return (
    <LinkRow
      href={href}
      title={prompt.instruction.vi}
      meta={[promptTagLabel(prompt.tag), minutes === null ? null : formatMinutes(minutes)]}
      badges={rowBadges(item.status)}
      trailing={rowStatus(state, showStatus)}
    />
  )
}
