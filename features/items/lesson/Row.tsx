import { LinkRow } from '@/components/patterns/link-row'
import { lessonType } from '@/lib/content/item-types/lesson'
import { formatMinutes } from '@/lib/i18n/format'
import { rowBadges, rowStatus } from '../status'
import { minutesOf } from '../track-info'
import type { ItemRowProps } from '../types'
import { lessonFormatLabel } from './format'

/** A lesson in a list: its title and "Pattern · 25 phút" (the manifest's lesson estimate). */
export function LessonRow({ item, state, mode, href, showStatus }: ItemRowProps<'lesson'>) {
  const minutes = minutesOf(lessonType, item, mode)
  return (
    <LinkRow
      href={href}
      title={item.title}
      meta={[
        lessonFormatLabel(item.content.format),
        minutes === null ? null : formatMinutes(minutes),
      ]}
      badges={rowBadges(item.status)}
      trailing={rowStatus(state, showStatus)}
    />
  )
}
