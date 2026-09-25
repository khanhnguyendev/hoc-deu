/**
 * Roadmap files, `content/tracks/<track>/roadmaps/<variant>.yaml` (platform design §3.4): weeks of
 * topics and item references by role. Roadmaps list structure, not every item — lessons,
 * exercises, prompts and cards are found by their own topic / week / tag fields.
 */
import { z } from 'zod'
import { whenFieldsValid } from './common'
import { itemIdSchema, slugSchema } from './ids'

/** How a recap entry revisits an item it does not introduce (§5.5, §5.6). */
export const RECAP_MODES = ['recall', 'redo', 'explain-aloud'] as const
export type RecapMode = (typeof RECAP_MODES)[number]

/** A recap entry; without a `mode` it introduces its item (e.g. 271 in DSA week 1, §5.3). */
export const recapEntrySchema = z.strictObject({
  item: itemIdSchema,
  mode: z.enum(RECAP_MODES).optional(),
})

export const roadmapWeekSchema = z.strictObject({
  week: z.number().int().positive(),
  topics: z.array(slugSchema).min(1),
  core: z.array(itemIdSchema).default([]),
  bonus: z.array(itemIdSchema).default([]),
  recap: z.array(recapEntrySchema).default([]),
  /** Deck IDs (`english:deck-w01-standup`). */
  decks: z.array(itemIdSchema).default([]),
})

type Week = z.infer<typeof roadmapWeekSchema>

/** Weeks numbered 1..n in file order; each item placed, each deck and topic listed, at most once. */
function checkRoadmap(roadmap: { weeks: Week[] }, ctx: z.RefinementCtx): void {
  const placed = new Set<string>()
  const decks = new Set<string>()
  const topics = new Set<string>()
  const once = (seen: Set<string>, value: string, path: (string | number)[], what: string) => {
    if (seen.has(value)) {
      ctx.addIssue({ code: 'custom', path, message: `${value} is ${what} more than once` })
    }
    seen.add(value)
  }

  roadmap.weeks.forEach((week, w) => {
    if (week.week !== w + 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['weeks', w, 'week'],
        message: `expected week ${w + 1}: weeks are numbered 1..n in file order`,
      })
    }
    week.topics.forEach((topic, j) => once(topics, topic, ['weeks', w, 'topics', j], 'a topic'))
    week.core.forEach((item, j) => once(placed, item, ['weeks', w, 'core', j], 'placed'))
    week.bonus.forEach((item, j) => once(placed, item, ['weeks', w, 'bonus', j], 'placed'))
    week.recap.forEach((entry, j) => {
      if (entry.mode === undefined) once(placed, entry.item, ['weeks', w, 'recap', j], 'placed')
    })
    week.decks.forEach((deck, j) => once(decks, deck, ['weeks', w, 'decks', j], 'listed'))
  })
}

export const roadmapSchema = z
  .strictObject({
    id: slugSchema,
    weeks: z.array(roadmapWeekSchema).min(1),
  })
  .superRefine(checkRoadmap, whenFieldsValid)

export type Roadmap = z.infer<typeof roadmapSchema>
export type RoadmapWeek = z.infer<typeof roadmapWeekSchema>
export type RecapEntry = z.infer<typeof recapEntrySchema>

/** Items a week introduces in queue order (§5.3): core, then recap entries without a mode. */
export function placedItems(week: RoadmapWeek): string[] {
  const introducedByRecap = week.recap.filter((entry) => entry.mode === undefined)
  return [...week.core, ...introducedByRecap.map((entry) => entry.item)]
}

/** §3.4 week sizes: core items plus `tier: core` cards of the week's decks. */
export function weekSizes(roadmap: Roadmap, coreCardsInDeck: (deckId: string) => number): number[] {
  return roadmap.weeks.map(
    (week) => week.core.length + week.decks.reduce((sum, deck) => sum + coreCardsInDeck(deck), 0),
  )
}
