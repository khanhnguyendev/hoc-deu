import { describe, expect, it } from 'vitest'
import {
  DSA_8W,
  DSA_TRACK,
  ENGLISH_10W,
  ENGLISH_TRACK,
  FIXTURE_ACCESS,
  FIXTURE_CATALOG,
} from './fixtures'
import { buildRoadmapView, itemLinkOf, resolveItemLink, type WeekView } from './view-model'

const ids = (items: readonly { id: string }[]) => items.map((item) => item.id)

const dsa = (includeDrafts: boolean) =>
  buildRoadmapView({ track: DSA_TRACK, roadmap: DSA_8W, access: FIXTURE_ACCESS, includeDrafts })
const english = (includeDrafts: boolean) =>
  buildRoadmapView({
    track: ENGLISH_TRACK,
    roadmap: ENGLISH_10W,
    access: FIXTURE_ACCESS,
    includeDrafts,
  })

const week = (view: { weeks: WeekView[] }, n: number): WeekView => {
  const found = view.weeks.find((candidate) => candidate.week === n)
  if (found === undefined) throw new Error(`no week ${n}`)
  return found
}

describe('buildRoadmapView — weeks', () => {
  it('names the variant and keeps the roadmap’s week order', () => {
    const view = dsa(false)
    expect(view.variant).toBe('8w')
    expect(view.weeks.map((w) => w.week)).toEqual([1, 2, 3])
  })

  it('titles the week topics from the manifest, falling back to the topic ID', () => {
    expect(week(dsa(false), 1).topics).toEqual([
      { id: 'arrays-hashing', title: 'Arrays & Hashing' },
      { id: 'two-pointers', title: 'Two Pointers' },
    ])
    expect(week(english(false), 2).topics).toEqual([{ id: 'code-review', title: 'code-review' }])
  })

  it('lists the topic lessons in topic order; a deep-dive (format requires about) is not one', () => {
    const lessons = week(dsa(false), 1).lessons
    expect(ids(lessons)).toEqual(['dsa:lesson-arrays-hashing', 'dsa:lesson-two-pointers'])
    expect(ids(lessons)).not.toContain('dsa:lesson-two-sum')
  })

  it('keeps core and bonus in roadmap order, narrowed to problems', () => {
    const first = week(dsa(false), 1)
    expect(ids(first.core)).toEqual(['dsa:lc-0001', 'dsa:lc-0167'])
    expect(first.core.every((item) => item.type === 'problem')).toBe(true)
    expect(ids(week(dsa(false), 2).core)).toEqual(['dsa:lc-0121'])
  })

  it('gives each recap entry its mode; an entry without one introduces its item (null)', () => {
    const recap = (n: number) =>
      week(dsa(false), n).recap.map(({ item, mode }) => [item.id, mode] as const)
    expect(recap(1)).toEqual([
      ['dsa:lc-0271', null],
      ['dsa:lc-0001', 'recall'],
    ])
    expect(recap(2)).toEqual([
      ['dsa:lc-0167', 'redo'],
      ['dsa:lc-0271', 'explain-aloud'],
    ])
  })

  it('shows drafts only with includeDrafts (admins)', () => {
    expect(ids(week(dsa(false), 1).core)).not.toContain('dsa:lc-0217')
    expect(ids(week(dsa(true), 1).core)).toEqual(['dsa:lc-0001', 'dsa:lc-0217', 'dsa:lc-0167'])
    expect(ids(week(dsa(true), 3).lessons)).toEqual(['dsa:lesson-stack'])
    expect(ids(week(english(true), 2).prompts)).toEqual(['english:prompt-w02-review'])
  })

  it('never shows retired items, even to admins', () => {
    for (const includeDrafts of [false, true]) {
      expect(week(dsa(includeDrafts), 1).bonus).toEqual([])
      expect(ids(dsa(includeDrafts).anytime.prompts)).not.toContain('dsa:prompt-old-mock')
      const deck = week(english(includeDrafts), 1).decks[0]
      expect(ids(deck?.extended ?? [])).toEqual(['english:w01-eta'])
    }
  })

  it('[RF-4] a week whose items are all drafts is an empty week for a learner', () => {
    expect(week(dsa(false), 3)).toEqual({
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
    expect(ids(week(dsa(true), 3).core)).toEqual(['dsa:lc-0020'])
    expect(ids(week(dsa(true), 3).bonus)).toEqual(['dsa:lc-0155'])
  })

  it('splits a deck’s cards into core and extended in file order; a deck with no card shown is left out', () => {
    const [deck] = week(english(false), 1).decks
    expect(deck?.deck.id).toBe('english:deck-w01-standup')
    expect(ids(deck?.core ?? [])).toEqual(['english:w01-blocker'])
    expect(ids(deck?.extended ?? [])).toEqual(['english:w01-eta'])
    // The w02 deck is a draft: learners do not see it, admins do.
    expect(week(english(false), 2).decks).toEqual([])
    const [draftDeck] = week(english(true), 2).decks
    expect(ids(draftDeck?.core ?? [])).toEqual(['english:w02-lgtm'])
    expect(ids(week(english(true), 1).decks[0]?.core ?? [])).toEqual([
      'english:w01-blocker',
      'english:w01-standup',
    ])
  })

  it('lists exercises and non-repeatable prompts by their own week', () => {
    const view = english(false)
    expect(ids(week(view, 1).exercises)).toEqual(['english:ex-w01-fill-1'])
    expect(ids(week(view, 2).exercises)).toEqual(['english:ex-w02-fill-1'])
    expect(ids(week(view, 1).prompts)).toEqual(['english:prompt-w01-standup-update'])
    expect(week(view, 2).prompts).toEqual([])
    expect(ids(week(english(true), 2).exercises)).toEqual([
      'english:ex-w02-fill-1',
      'english:ex-w02-fill-2',
    ])
  })
})

describe('buildRoadmapView — anytime', () => {
  it('puts repeatable prompts under anytime, never in a week', () => {
    const view = dsa(false)
    expect(ids(view.anytime.prompts)).toEqual(['dsa:prompt-mock-interview'])
    for (const w of view.weeks) expect(ids(w.prompts)).not.toContain('dsa:prompt-mock-interview')
  })

  it('lists the track’s derived decks with the cards that can unlock (retired ones not counted)', () => {
    expect(english(false).anytime.derivedDecks).toEqual([
      { deck: FIXTURE_CATALOG.decks['english:explaining-code'], unlocked: 1 },
    ])
    expect(dsa(false).anytime.derivedDecks).toEqual([])
  })
})

describe('itemLinkOf / resolveItemLink', () => {
  it('links a problem with its LeetCode number and difficulty, other items without', () => {
    expect(itemLinkOf(FIXTURE_ACCESS.getItem('dsa:lc-0001')!)).toEqual({
      id: 'dsa:lc-0001',
      type: 'problem',
      title: 'Two Sum',
      href: '/t/dsa/items/lc-0001',
      leetcode: 1,
      difficulty: 'E',
    })
    expect(
      itemLinkOf(FIXTURE_ACCESS.getItem('english:explaining-code:dsa:lc-0001')!),
    ).toMatchObject({
      type: 'flashcard',
      href: '/t/english/items/explaining-code%3Adsa%3Alc-0001',
      leetcode: null,
      difficulty: null,
    })
  })

  it('resolves drafts for admins only; retired items stay linkable; unknown IDs are null', () => {
    expect(resolveItemLink(FIXTURE_ACCESS, 'dsa:lc-0217', false)).toBeNull()
    expect(resolveItemLink(FIXTURE_ACCESS, 'dsa:lc-0217', true)?.id).toBe('dsa:lc-0217')
    expect(resolveItemLink(FIXTURE_ACCESS, 'dsa:lc-0015', false)?.id).toBe('dsa:lc-0015')
    expect(resolveItemLink(FIXTURE_ACCESS, 'dsa:lc-9999', true)).toBeNull()
    expect(resolveItemLink(FIXTURE_ACCESS, 'toString', true)).toBeNull()
  })
})
