import { Section } from '@/components/patterns/section'
import { fill } from '@/features/items/components/mdx/copy'
import { formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { RoadmapSlots } from '../slots'
import { DeckCard, DeckList, RoadmapGroup, RowGroup, WeekSection } from './week-section'

const copy = vi.roadmap

/**
 * A track's roadmap (platform design §3.4): one WeekSection per roadmap week, in order, then
 * "Không theo tuần" — repeatable prompts and derived decks (with the cards a learner can unlock) —
 * when there is any. Takes ReactNode slots (`roadmapSlots`, fix 5); a `contents` wrapper, so each
 * section is spaced like any other on the page.
 */
function RoadmapView({ slots }: { slots: RoadmapSlots }) {
  const { prompts, derivedDecks } = slots.anytime
  return (
    <div data-slot="roadmap-view" data-variant={slots.variant} className="contents">
      {slots.weeks.map((week) => (
        <WeekSection key={week.week} week={week} />
      ))}
      {(prompts.length > 0 || derivedDecks.length > 0) && (
        <Section title={copy.anytime.title} description={copy.anytime.description}>
          <RowGroup title={copy.week.prompts} rows={prompts} />
          {derivedDecks.length > 0 && (
            <RoadmapGroup title={copy.week.decks}>
              {(id) => (
                <DeckList labelledBy={id}>
                  {derivedDecks.map(({ deck, unlocked }) => (
                    <DeckCard key={deck.id} title={deck.title.vi}>
                      <p className="text-sm">
                        {fill(copy.anytime.derivedCount, { count: formatNumber(unlocked) })}
                      </p>
                      <p className="text-sm text-muted-foreground">{copy.anytime.derivedHint}</p>
                    </DeckCard>
                  ))}
                </DeckList>
              )}
            </RoadmapGroup>
          )}
        </Section>
      )}
    </div>
  )
}

export { RoadmapView }
