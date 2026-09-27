import { LinkList } from '@/components/patterns/link-list'
import { LinkRow } from '@/components/patterns/link-row'
import { Section } from '@/components/patterns/section'
import { StatusPill } from '@/components/patterns/status-pill'
import { fill, formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { WeakTopicView } from '../view-model'

const copy = vi.today.weakAreas

/**
 * Weak areas (§5.7): topics of active tracks with at least two Weak items, most first — each a
 * link to its track, with the track and the Weak count, and the "Yếu" pill (icon + label, never
 * colour alone). None: one line says so.
 */
function WeakAreas({ topics }: { topics: readonly WeakTopicView[] }) {
  return (
    <Section title={copy.title}>
      {topics.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.empty}</p>
      ) : (
        <LinkList>
          {topics.map((topic) => (
            <li key={`${topic.trackId}/${topic.topicId}`}>
              <LinkRow
                href={`/t/${topic.trackId}`}
                title={topic.title}
                meta={[topic.trackTitle, fill(copy.count, { n: formatNumber(topic.count) })]}
                trailing={<StatusPill status="weak" />}
              />
            </li>
          ))}
        </LinkList>
      )}
    </Section>
  )
}

export { WeakAreas }
