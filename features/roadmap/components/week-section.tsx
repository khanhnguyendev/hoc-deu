import { useId } from 'react'
import type * as React from 'react'
import { Section } from '@/components/patterns/section'
import { Badge } from '@/components/ui/badge'
import { fill } from '@/features/items/components/mdx/copy'
import { formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { WeekSlots } from '../slots'

const copy = vi.roadmap

/** An `h3` and what it labels (a list gets the heading's id for `aria-labelledby`). */
function RoadmapGroup({
  title,
  children,
}: {
  title: string
  children: (headingId: string) => React.ReactNode
}) {
  const headingId = useId()
  return (
    <div data-slot="roadmap-group" className="flex flex-col gap-2">
      <h3 id={headingId} className="text-base font-semibold">
        {title}
      </h3>
      {children(headingId)}
    </div>
  )
}

/** Item rows (registry Rows, each one link) as a bordered list; `role="list"` survives Safari. */
function RowList({ rows, labelledBy }: { rows: React.ReactNode[]; labelledBy?: string }) {
  return (
    <ul
      role="list"
      aria-labelledby={labelledBy}
      className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface p-1"
    >
      {rows.map((row, index) => (
        // Rows are a fixed, ordered list; one item may appear twice (core, then recap).
        <li key={index}>{row}</li>
      ))}
    </ul>
  )
}

/** A titled group of rows; nothing when there are none. */
function RowGroup({ title, rows }: { title: string; rows: React.ReactNode[] }) {
  if (rows.length === 0) return null
  return (
    <RoadmapGroup title={title}>{(id) => <RowList rows={rows} labelledBy={id} />}</RoadmapGroup>
  )
}

/** A deck as a card in a list: its title (`h4`), then its facts and cards. */
function DeckCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
      <h4 className="font-medium">{title}</h4>
      {children}
    </li>
  )
}

/** Cards in a list of decks. */
function DeckList({ labelledBy, children }: { labelledBy: string; children: React.ReactNode }) {
  return (
    <ul role="list" aria-labelledby={labelledBy} className="flex flex-col gap-3">
      {children}
    </ul>
  )
}

const recapRows = (recap: WeekSlots['recap']): React.ReactNode[] =>
  recap.map(({ row, mode }) =>
    mode === null ? (
      row
    ) : (
      <>
        <span className="block px-3 pt-2 text-xs font-medium text-muted-foreground">
          {copy.recapMode[mode]}
        </span>{' '}
        {row}
      </>
    ),
  )

const isEmpty = (week: WeekSlots) =>
  week.lessons.length +
    week.core.length +
    week.recap.length +
    week.bonus.length +
    week.decks.length +
    week.exercises.length +
    week.prompts.length ===
  0

/**
 * One roadmap week (platform design §3.4): "Tuần {n}" with its topic chips, then — each only when
 * it has rows — lessons, core problems ("Bài chính"), the weekend recap with its modes, bonus
 * problems, decks (counts by tier, cards in a disclosure), exercises and prompts. The rows are
 * ReactNodes the page built through the registry (fix 5). A week with nothing says so (RF-4).
 */
function WeekSection({ week }: { week: WeekSlots }) {
  return (
    <Section title={fill(copy.week.title, { n: formatNumber(week.week) })}>
      <ul role="list" aria-label={copy.week.topics} className="flex flex-wrap gap-2">
        {week.topics.map((topic) => (
          <li key={topic.id}>
            <Badge>{topic.title}</Badge>
          </li>
        ))}
      </ul>
      {isEmpty(week) ? (
        <p className="text-sm text-muted-foreground">{copy.week.empty}</p>
      ) : (
        <>
          <RowGroup title={copy.week.lessons} rows={week.lessons} />
          <RowGroup title={copy.week.core} rows={week.core} />
          <RowGroup title={copy.week.recap} rows={recapRows(week.recap)} />
          <RowGroup title={copy.week.bonus} rows={week.bonus} />
          {week.decks.length > 0 && (
            <RoadmapGroup title={copy.week.decks}>
              {(id) => (
                <DeckList labelledBy={id}>
                  {week.decks.map(({ deck, core, extended }) => (
                    <DeckCard key={deck.id} title={deck.title.vi}>
                      <p className="text-sm text-muted-foreground">
                        {fill(copy.week.deckCounts, {
                          core: formatNumber(core.length),
                          extended: formatNumber(extended.length),
                        })}
                      </p>
                      <details>
                        <summary className="min-h-11 cursor-pointer py-2.5 text-sm font-medium text-primary">
                          {copy.week.showCards}
                        </summary>
                        <RowList rows={[...core, ...extended]} />
                      </details>
                    </DeckCard>
                  ))}
                </DeckList>
              )}
            </RoadmapGroup>
          )}
          <RowGroup title={copy.week.exercises} rows={week.exercises} />
          <RowGroup title={copy.week.prompts} rows={week.prompts} />
        </>
      )}
    </Section>
  )
}

export { DeckCard, DeckList, RoadmapGroup, RowGroup, WeekSection }
