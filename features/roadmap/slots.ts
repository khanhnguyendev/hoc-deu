/**
 * A roadmap view as ReactNode slots (gate-review fix 5): the page renders each item's row through
 * the registry (`renderItemRow`) with this callback, so `features/roadmap/components` take plain
 * nodes and never import the registry — they render in the client component catalog too. Pure.
 */
import type * as React from 'react'
import type { CatalogItem, DeckSummary } from '@/lib/content/catalog-types'
import type { RecapMode } from '@/lib/content/schemas/roadmap'
import type { RoadmapView } from './view-model'

/** Renders one item's row; `mode` is the recap mode of a recap entry, else null. */
export type RowRenderer = (item: CatalogItem, extra: { mode: RecapMode | null }) => React.ReactNode

export type WeekSlots = {
  week: number
  topics: { id: string; title: string }[]
  lessons: React.ReactNode[]
  core: React.ReactNode[]
  recap: { row: React.ReactNode; mode: RecapMode | null }[]
  bonus: React.ReactNode[]
  decks: { deck: DeckSummary; core: React.ReactNode[]; extended: React.ReactNode[] }[]
  exercises: React.ReactNode[]
  prompts: React.ReactNode[]
}

export type RoadmapSlots = {
  variant: string
  weeks: WeekSlots[]
  anytime: {
    prompts: React.ReactNode[]
    derivedDecks: { deck: DeckSummary; unlocked: number }[]
  }
}

/** Calls `renderRow` once per listed item, in view order, with its recap mode (else null). */
export function roadmapSlots(view: RoadmapView, renderRow: RowRenderer): RoadmapSlots {
  const rows = (items: readonly CatalogItem[]) =>
    items.map((item) => renderRow(item, { mode: null }))
  return {
    variant: view.variant,
    weeks: view.weeks.map((week) => ({
      week: week.week,
      topics: week.topics,
      lessons: rows(week.lessons),
      core: rows(week.core),
      recap: week.recap.map(({ item, mode }) => ({ row: renderRow(item, { mode }), mode })),
      bonus: rows(week.bonus),
      decks: week.decks.map(({ deck, core, extended }) => ({
        deck,
        core: rows(core),
        extended: rows(extended),
      })),
      exercises: rows(week.exercises),
      prompts: rows(week.prompts),
    })),
    anytime: {
      prompts: rows(view.anytime.prompts),
      derivedDecks: view.anytime.derivedDecks,
    },
  }
}
