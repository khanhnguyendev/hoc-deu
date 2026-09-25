import { describe, expect, it, vi } from 'vitest'
import type { CatalogItem } from '@/lib/content/catalog-types'
import type { RecapMode } from '@/lib/content/schemas/roadmap'
import { DSA_8W, DSA_TRACK, ENGLISH_10W, ENGLISH_TRACK, FIXTURE_ACCESS } from './fixtures'
import { roadmapSlots, type RowRenderer } from './slots'
import { buildRoadmapView } from './view-model'

const dsaView = buildRoadmapView({
  track: DSA_TRACK,
  roadmap: DSA_8W,
  access: FIXTURE_ACCESS,
  includeDrafts: false,
})
const englishView = buildRoadmapView({
  track: ENGLISH_TRACK,
  roadmap: ENGLISH_10W,
  access: FIXTURE_ACCESS,
  includeDrafts: false,
})

/** A renderer that returns a marker string per call, so the slots show which item went where. */
function recorder() {
  const calls: [string, RecapMode | null][] = []
  const render = vi.fn<RowRenderer>((item: CatalogItem, { mode }) => {
    calls.push([item.id, mode])
    return `row:${item.id}${mode === null ? '' : `:${mode}`}`
  })
  return { calls, render }
}

describe('roadmapSlots', () => {
  it('calls the renderer once per item, in view order, with the recap mode', () => {
    const { calls, render } = recorder()
    const slots = roadmapSlots(dsaView, render)
    expect(calls).toEqual([
      // week 1: lessons, core, recap, bonus, decks, exercises, prompts
      ['dsa:lesson-arrays-hashing', null],
      ['dsa:lesson-two-pointers', null],
      ['dsa:lc-0001', null],
      ['dsa:lc-0167', null],
      ['dsa:lc-0271', null],
      ['dsa:lc-0001', 'recall'],
      // week 2
      ['dsa:lc-0121', null],
      ['dsa:lc-0167', 'redo'],
      ['dsa:lc-0271', 'explain-aloud'],
      // anytime
      ['dsa:prompt-mock-interview', null],
    ])
    expect(slots.variant).toBe('8w')
    expect(slots.weeks[0]?.core).toEqual(['row:dsa:lc-0001', 'row:dsa:lc-0167'])
    expect(slots.weeks[0]?.recap).toEqual([
      { row: 'row:dsa:lc-0271', mode: null },
      { row: 'row:dsa:lc-0001:recall', mode: 'recall' },
    ])
    expect(slots.anytime.prompts).toEqual(['row:dsa:prompt-mock-interview'])
  })

  it('keeps week numbers and topics, and leaves an empty week empty', () => {
    const { render } = recorder()
    const slots = roadmapSlots(dsaView, render)
    expect(slots.weeks.map((week) => week.week)).toEqual([1, 2, 3])
    expect(slots.weeks[2]).toEqual({
      week: 3,
      topics: [{ id: 'stack', title: 'Stack' }],
      lessons: [],
      core: [],
      recap: [],
      bonus: [],
      decks: [],
      exercises: [],
      prompts: [],
    })
  })

  it('renders deck cards by tier, exercises and prompts, and passes derived decks through', () => {
    const { render } = recorder()
    const slots = roadmapSlots(englishView, render)
    const [deck] = slots.weeks[0]?.decks ?? []
    expect(deck?.deck.id).toBe('english:deck-w01-standup')
    expect(deck?.core).toEqual(['row:english:w01-blocker'])
    expect(deck?.extended).toEqual(['row:english:w01-eta'])
    expect(slots.weeks[0]?.exercises).toEqual(['row:english:ex-w01-fill-1'])
    expect(slots.weeks[0]?.prompts).toEqual(['row:english:prompt-w01-standup-update'])
    expect(slots.anytime.derivedDecks).toBe(englishView.anytime.derivedDecks)
  })
})
