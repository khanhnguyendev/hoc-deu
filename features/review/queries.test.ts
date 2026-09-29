import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlanCatalog } from '@/lib/domain/catalog'
import type { ItemState } from '@/lib/domain/state'

const fake = vi.hoisted(() => ({
  user: { id: 'me' },
  versions: [] as unknown[],
  enrollments: [] as {
    trackId: string
    status: 'active' | 'paused' | 'removed'
    startDate: string
  }[],
  items: {} as Record<string, ItemState>,
  userItems: [] as unknown[],
  calls: [] as unknown[][],
}))

const SRS = { intervals: [1, 3], relearnDays: 1, masteredAfter: 2 }

const CATALOG: PlanCatalog = {
  tracks: {
    dsa: {
      id: 'dsa',
      status: 'active',
      weeklyTemplate: {},
      defaults: { budgetMinutes: 60, newPerDay: null, throttle: [] },
      roadmaps: {},
    },
    english: {
      id: 'english',
      status: 'active',
      weeklyTemplate: {},
      defaults: { budgetMinutes: 25, newPerDay: null, throttle: [] },
      roadmaps: {},
    },
  },
  items: {
    'dsa:p1': {
      id: 'dsa:p1',
      trackId: 'dsa',
      itemType: 'problem',
      topicId: 'arrays',
      week: null,
      status: 'active',
      srs: SRS,
      minutes: { new: 20, review: 5, recall: 5, redo: 12, 'explain-aloud': 5 },
      reviewModes: true,
      difficulty: 'E',
      tier: null,
      deckId: null,
      derivedFrom: null,
      about: null,
      deepDiveId: null,
      tag: null,
      repeatable: false,
      hasExample: false,
    },
    'english:e1': {
      id: 'english:e1',
      trackId: 'english',
      itemType: 'flashcard',
      topicId: 'standup',
      week: 1,
      status: 'active',
      srs: SRS,
      minutes: { new: 1.5, review: 0.5, recall: 0.5, redo: 0.5, 'explain-aloud': 0.5 },
      reviewModes: false,
      difficulty: null,
      tier: 'core',
      deckId: 'english:deck-w1',
      derivedFrom: null,
      about: null,
      deepDiveId: null,
      tag: null,
      repeatable: false,
      hasExample: false,
    },
  },
  decks: {},
}

const CARD_ITEM = {
  id: 'english:e1',
  type: 'flashcard',
  content: {
    front: 'blocker',
    back: 'vấn đề đang chặn',
    hint: null,
    usage: undefined,
    example: 'I have one blocker.',
    pronunciation: '/blok/',
    lang: { front: 'en', back: 'vi', hint: 'vi' },
  },
}
const PROBLEM_ITEM = { id: 'dsa:p1', type: 'problem', content: {} }

vi.mock('@/lib/auth/dal', () => ({
  requireOnboarded: async () => {
    fake.calls.push(['requireOnboarded'])
    return fake.user
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    fake.calls.push(['createClient'])
    return { __session: true }
  },
}))
vi.mock('@/lib/plans/catalog', () => ({ planCatalog: () => CATALOG }))
vi.mock('@/lib/plans/reads', () => ({
  readScheduleVersions: async () => {
    fake.calls.push(['readScheduleVersions'])
    return fake.versions
  },
  readEnrollments: async () => {
    fake.calls.push(['readEnrollments'])
    return fake.enrollments
  },
  readItemStates: async () => {
    fake.calls.push(['readItemStates'])
    return fake.items
  },
  todayOf: () => '2026-10-10',
  readUserItems: async () => {
    fake.calls.push(['readUserItems'])
    return fake.userItems
  },
}))
vi.mock('@/lib/content/catalog', async () => {
  const { CATALOG: GENERATED } = await import('@/.generated/catalog')
  return {
    getCatalog: () => ({ tracks: GENERATED.tracks }),
    getItem: (id: string) =>
      id === 'english:e1' ? CARD_ITEM : id === 'dsa:p1' ? PROBLEM_ITEM : null,
    getTrack: (id: string) => ({ title: { vi: id === 'dsa' ? 'DSA' : 'English', en: id } }),
  }
})

const { getReview } = await import('./queries')

beforeEach(() => {
  fake.user = { id: 'me' }
  fake.versions = []
  fake.enrollments = [
    { trackId: 'dsa', status: 'active', startDate: '2020-01-01' },
    { trackId: 'english', status: 'active', startDate: '2020-01-01' },
  ]
  fake.items = {
    'dsa:p1': {
      itemId: 'dsa:p1',
      trackId: 'dsa',
      topicId: 'arrays',
      itemType: 'problem',
      level: 1,
      weak: false,
      topSuccesses: 0,
      status: 'ok',
      dueOn: '2026-10-10',
      lastResult: 'solved',
      lastResultOn: '2026-10-01',
      introducedOn: '2026-10-01',
      lapses: 0,
      reps: 1,
    },
    'english:e1': {
      itemId: 'english:e1',
      trackId: 'english',
      topicId: 'standup',
      itemType: 'flashcard',
      level: 1,
      weak: true,
      topSuccesses: 0,
      status: 'weak',
      dueOn: '2026-10-10',
      lastResult: 'unsure',
      lastResultOn: '2026-10-01',
      introducedOn: '2026-10-01',
      lapses: 0,
      reps: 1,
    },
  }
  fake.userItems = []
  fake.calls = []
})

describe('getReview (task 5.3)', () => {
  it('guards first, then reads the schedule, enrollments and item states', async () => {
    await getReview(undefined)
    expect(fake.calls[0]).toEqual(['requireOnboarded'])
    expect(fake.calls[1]).toEqual(['createClient'])
    expect(fake.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining(['readScheduleVersions', 'readEnrollments', 'readItemStates']),
    )
  })

  it('orders entries Weak first across tracks', async () => {
    const page = await getReview(undefined)
    expect(page.entries.map((entry) => entry.itemId)).toEqual(['english:e1', 'dsa:p1'])
  })

  it("loads a due flashcard's sides, in queue order", async () => {
    const page = await getReview(undefined)
    expect(page.cards).toEqual([
      {
        itemId: 'english:e1',
        sides: {
          front: 'blocker',
          back: 'vấn đề đang chặn',
          hint: null,
          usage: undefined,
          example: 'I have one blocker.',
          pronunciation: '/blok/',
          lang: { front: 'en', back: 'vi', hint: 'vi' },
        },
      },
    ])
  })

  it('lists every active track with its title and due count', async () => {
    const page = await getReview(undefined)
    expect(page.tracks).toEqual([
      { id: 'dsa', title: 'DSA', count: 1 },
      { id: 'english', title: 'English', count: 1 },
    ])
  })

  it('`?track=` filters the entries and cards, `tracks` stays the full breakdown', async () => {
    const page = await getReview('english')
    expect(page.entries.map((entry) => entry.itemId)).toEqual(['english:e1'])
    expect(page.cards.map((card) => card.itemId)).toEqual(['english:e1'])
    expect(page.tracks).toEqual([
      { id: 'dsa', title: 'DSA', count: 1 },
      { id: 'english', title: 'English', count: 1 },
    ])
    expect(page.track).toBe('english')
  })

  it('an unknown `?track=` reads as all and reports `track: null`', async () => {
    const page = await getReview('not-a-track')
    expect(page.entries).toHaveLength(2)
    expect(page.track).toBeNull()
  })

  it('gives each render a fresh request id', async () => {
    const a = await getReview(undefined)
    const b = await getReview(undefined)
    expect(a.requestId).not.toBe(b.requestId)
  })
})

describe('getReview — custom items (task 6.6a, decision 17)', () => {
  const CARD = 'user:0123456789abcdef:standup-card'
  const dueCard = (itemId: string): ItemState => ({
    itemId,
    trackId: 'english',
    topicId: 'standup',
    itemType: 'flashcard',
    level: 1,
    weak: false,
    topSuccesses: 0,
    status: 'ok',
    dueOn: '2026-10-09',
    lastResult: 'know',
    lastResultOn: '2026-10-08',
    introducedOn: '2026-10-08',
    lapses: 0,
    reps: 1,
  })
  const row = (status = 'active') => ({
    itemId: CARD,
    itemType: 'flashcard',
    trackId: 'english',
    topicId: 'standup',
    payload: { front: 'on hold', back: 'tạm dừng', tags: [] },
    status,
    createdOn: '2026-10-01',
  })

  it('a due custom card is in the queue and the card session, with its sides and its URL', async () => {
    fake.items = { [CARD]: dueCard(CARD) }
    fake.userItems = [row()]
    const page = await getReview(undefined)
    expect(fake.calls).toContainEqual(['readUserItems'])
    expect(page.entries).toEqual([
      expect.objectContaining({
        itemId: CARD,
        trackId: 'english',
        href: '/t/english/items/user%3A0123456789abcdef%3Astandup-card?mode=review',
      }),
    ])
    expect(page.cards).toEqual([
      {
        itemId: CARD,
        sides: expect.objectContaining({ front: 'on hold', back: 'tạm dừng' }),
      },
    ])
  })

  it('a hidden custom card is out of the queue (it reads as retired); its state is kept', async () => {
    fake.items = { [CARD]: dueCard(CARD) }
    fake.userItems = [row('hidden')]
    const page = await getReview(undefined)
    expect(page.entries).toEqual([])
    expect(page.cards).toEqual([])
  })
})
