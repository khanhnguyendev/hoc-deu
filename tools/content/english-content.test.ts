/**
 * Pins the English track's simulation input (platform design §5.10, task 3.10, fix 20): the 10w
 * roadmap's weeks — topic and deck lists — and the `tier: core` cards per week (135 in all).
 * Extended cards, exercises and prompts are not pinned, so later content PRs never touch this test.
 * It builds the real `content/**` in check mode (the lock is never written) into a temp `outDir`.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Catalog } from '@/lib/content/catalog-types'
import { weekSizes, type Roadmap } from '@/lib/content/schemas/roadmap'
import { buildContent } from './build'

const REPO = path.resolve(import.meta.dirname, '../..')

/** The 10w weeks in order: topic, deck and core cards (task 3.10 table, decision 30). */
const WEEKS = [
  { topic: 'standup', deck: 'english:deck-w01-standup', core: 12 },
  { topic: 'tickets', deck: 'english:deck-w02-tickets', core: 16 },
  { topic: 'code-review', deck: 'english:deck-w03-code-review', core: 14 },
  { topic: 'pull-requests', deck: 'english:deck-w04-pull-requests', core: 14 },
  { topic: 'meetings', deck: 'english:deck-w05-meetings', core: 12 },
  { topic: 'estimates', deck: 'english:deck-w06-estimates', core: 13 },
  { topic: 'incidents', deck: 'english:deck-w07-incidents', core: 16 },
  { topic: 'documentation', deck: 'english:deck-w08-documentation', core: 14 },
  { topic: 'interviews', deck: 'english:deck-w09-interviews', core: 11 },
  { topic: 'demos', deck: 'english:deck-w10-demos', core: 13 },
] as const

let outDir: string
let catalog: Catalog

beforeAll(async () => {
  outDir = mkdtempSync(path.join(tmpdir(), 'english-content-'))
  const result = await buildContent({ repoRoot: REPO, outDir, check: true })
  expect(result.issues).toEqual([])
  if (result.catalog === null) throw new Error('content:build produced no catalog')
  catalog = result.catalog
}, 60_000)

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true })
})

const roadmap10w = (): Roadmap => {
  const roadmap = catalog.roadmaps.english?.['10w']
  if (roadmap === undefined) throw new Error('no english 10w roadmap')
  return roadmap
}

/** Active `tier: core` cards of a deck — what week sizes count (§3.4, report.ts). */
const coreCards = (deckId: string): number =>
  (catalog.decks[deckId]?.cardIds ?? []).filter((id) => {
    const item = catalog.items[id]
    return item?.type === 'flashcard' && item.status === 'active' && item.content.tier === 'core'
  }).length

describe('English 10w roadmap (simulation input)', () => {
  it('lists one topic and its deck per week, in the table order', () => {
    expect(roadmap10w().weeks.map(({ week, topics, decks }) => ({ week, topics, decks }))).toEqual(
      WEEKS.map(({ topic, deck }, index) => ({ week: index + 1, topics: [topic], decks: [deck] })),
    )
  })

  it('gives each deck its week and topic', () => {
    for (const [index, { topic, deck }] of WEEKS.entries()) {
      expect(catalog.decks[deck]).toMatchObject({
        kind: 'vocabulary',
        week: index + 1,
        topicId: topic,
      })
    }
  })

  it('has the tier: core card count per week — 135 in all', () => {
    const sizes = weekSizes(roadmap10w(), coreCards)
    expect(sizes).toEqual(WEEKS.map(({ core }) => core))
    expect(sizes).toEqual([12, 16, 14, 14, 12, 13, 16, 14, 11, 13])
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(135)
  })
})
