import { MapIcon } from 'lucide-react'
import type * as React from 'react'
import { EmptyState } from '@/components/patterns/empty-state'
import { Section } from '@/components/patterns/section'
import { vi } from '@/lib/i18n/vi'
import type { TracksOverview, TrackSummary } from '../queries'
import { TrackCard } from './track-card'

const copy = vi.roadmap

function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <ul role="list" className="grid gap-4 md:grid-cols-2">
      {children}
    </ul>
  )
}

/**
 * `/tracks` below its header (platform design §2.4): "Lộ trình của bạn" (the learner's tracks) and
 * "Lộ trình khác" (tracks they could add in Settings). With no track at all, one empty state; with
 * none followed, an empty state pointing to Settings (RF-4).
 */
function TrackList({ mine, others }: { mine: TracksOverview['mine']; others: TrackSummary[] }) {
  if (mine.length === 0 && others.length === 0) {
    return (
      <EmptyState icon={MapIcon} title={copy.empty.title} description={copy.empty.description} />
    )
  }
  return (
    <>
      <Section title={copy.mine}>
        {mine.length === 0 ? (
          <EmptyState
            icon={MapIcon}
            titleAs="h3"
            title={copy.emptyMine.title}
            description={copy.emptyMine.description}
            action={{ label: copy.emptyMine.action, href: '/settings' }}
          />
        ) : (
          <CardGrid>
            {mine.map(({ track, enrollment }) => (
              <li key={track.id}>
                <TrackCard track={track} enrollment={enrollment} />
              </li>
            ))}
          </CardGrid>
        )}
      </Section>
      <Section title={copy.others}>
        {others.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.noOthers}</p>
        ) : (
          <CardGrid>
            {others.map((track) => (
              <li key={track.id}>
                <TrackCard track={track} enrollment={null} />
              </li>
            ))}
          </CardGrid>
        )}
      </Section>
    </>
  )
}

export { TrackList }
