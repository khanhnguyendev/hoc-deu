import { describe, expect, it } from 'vitest'
import type { Catalog, CatalogItem, WeekCoverage } from '@/lib/content/catalog-types'
import type { TrackManifest } from '@/lib/content/schemas/manifest'
import {
  buildContentPage,
  coverageHorizon,
  coverageWarnings,
  HORIZON_WEEKS,
  type PublishRequestRow,
  type TrackPosition,
} from './content'

// ---------------------------------------------------------------------------------------------
// A small catalog: DSA (lessons, problems, flashcards, prompts; 10w roadmap of 7 weeks, 8w
// listed without a file) and English (flashcards, exercises, prompts; topics without lessons).
// ---------------------------------------------------------------------------------------------

const track = (manifest: Partial<TrackManifest> & Pick<TrackManifest, 'id'>): TrackManifest =>
  ({
    status: 'active',
    title: { vi: manifest.id.toUpperCase(), en: manifest.id },
    accent: 'track-1',
    topics: [],
    roadmaps: [],
    ...manifest,
  }) as unknown as TrackManifest

const DSA = track({
  id: 'dsa',
  title: { vi: 'Cấu trúc dữ liệu & Giải thuật', en: 'DSA' },
  itemTypes: ['lesson', 'problem', 'prompt', 'flashcard'],
  topics: [
    { id: 'arrays', title: { vi: 'Mảng', en: 'Arrays' }, signals: [], requires: [] },
    {
      id: 'linked-list',
      title: { vi: 'Danh sách liên kết', en: 'Linked list' },
      signals: [],
      requires: [],
    },
  ],
  roadmaps: [
    { id: '10w', minBudget: 75 },
    { id: '8w', minBudget: 10 },
  ] as unknown as TrackManifest['roadmaps'],
})
const ENGLISH = track({
  id: 'english',
  accent: 'track-2',
  title: { vi: 'Tiếng Anh cho môi trường IT', en: 'English' },
  itemTypes: ['flashcard', 'exercise', 'prompt'],
  roadmaps: [{ id: '10w', minBudget: 10 }] as unknown as TrackManifest['roadmaps'],
})
const DRAFT_TRACK = track({
  id: 'system-design',
  status: 'draft',
  title: { vi: 'Thiết kế hệ thống', en: 'System design' },
  itemTypes: ['lesson'],
})

/** A covered DSA week: its lesson and every placed problem's note. */
const week = (n: number, overrides: Partial<WeekCoverage> = {}): WeekCoverage => ({
  week: n,
  topics: ['arrays'],
  lessons: [{ topic: 'arrays', lessonId: 'dsa:lesson-arrays' }],
  placedProblems: 8,
  notedProblems: 8,
  bonusProblems: 0,
  notedBonus: 0,
  coreCards: 0,
  extendedCards: 0,
  exercises: 0,
  prompts: 1,
  ...overrides,
})
/** Weeks 4+ as DSA has them today: no lesson, no note. */
const gap = (n: number): WeekCoverage =>
  week(n, {
    topics: ['linked-list'],
    lessons: [{ topic: 'linked-list', lessonId: null }],
    notedProblems: 0,
  })

const DSA_10W = [week(1), week(2), week(3), gap(4), gap(5), gap(6), gap(7)]
const ENGLISH_10W = [1, 2, 3, 4, 5].map((n) =>
  week(n, {
    topics: ['standup'],
    // English lists no lessons: its topics never have one, which is not a gap.
    lessons: [{ topic: 'standup', lessonId: null }],
    placedProblems: 0,
    notedProblems: 0,
    coreCards: 12,
    extendedCards: n <= 3 ? 10 : 0,
    exercises: n <= 3 ? 6 : 0,
  }),
)

const item = (
  entry: Partial<CatalogItem> & Pick<CatalogItem, 'id' | 'type' | 'trackId'>,
): CatalogItem =>
  ({
    localId: entry.id.slice(entry.id.indexOf(':') + 1),
    topicId: null,
    week: null,
    status: 'active',
    title: entry.id,
    source: `content/${entry.id}`,
    content: {},
    ...entry,
  }) as CatalogItem

const note = (status: 'active' | 'draft', verification: 'tested' | 'compile-only') => ({
  status,
  mdxKey: 'x#note',
  verification,
  languages: [],
  bilingual: { vi: '', en: '' },
  complexity: { time: '', space: '' },
  deepDiveId: null,
})

const ITEMS: CatalogItem[] = [
  item({ id: 'dsa:lesson-arrays', type: 'lesson', trackId: 'dsa', title: 'Mảng và băm' }),
  item({
    id: 'dsa:lesson-linked-list',
    type: 'lesson',
    trackId: 'dsa',
    status: 'draft',
    title: 'Danh sách liên kết',
  }),
  item({
    id: 'dsa:lc-0001',
    type: 'problem',
    trackId: 'dsa',
    title: 'Two Sum',
    content: { note: note('active', 'tested') } as never,
  }),
  item({
    id: 'dsa:lc-0020',
    type: 'problem',
    trackId: 'dsa',
    title: 'Valid Parentheses',
    content: { note: note('active', 'compile-only') } as never,
  }),
  item({
    id: 'dsa:lc-0206',
    type: 'problem',
    trackId: 'dsa',
    title: 'Reverse Linked List',
    content: { note: { ...note('draft', 'tested'), mdxKey: 'dsa:lc-0206#note' } } as never,
  }),
  item({
    id: 'dsa:lc-0146',
    type: 'problem',
    trackId: 'dsa',
    status: 'draft',
    title: 'LRU Cache',
    content: { note: null } as never,
  }),
  item({
    id: 'dsa:lc-0999',
    type: 'problem',
    trackId: 'dsa',
    status: 'retired',
    title: 'Retired',
    content: { note: null } as never,
  }),
  item({
    id: 'english:standup:c1',
    type: 'flashcard',
    trackId: 'english',
    title: 'blocker',
    content: { lang: { front: 'en', back: 'vi', hint: 'vi' } } as never,
  }),
  item({
    id: 'english:standup:c2',
    type: 'flashcard',
    trackId: 'english',
    status: 'draft',
    title: 'heads-up',
    content: { lang: { front: 'en', back: 'vi', hint: 'vi' } } as never,
  }),
  item({ id: 'english:ex-1', type: 'exercise', trackId: 'english', title: 'Điền từ' }),
]

const CATALOG = {
  schemaVersion: 1,
  tracks: [DSA, ENGLISH, DRAFT_TRACK],
  roadmaps: {},
  missingRoadmaps: [{ trackId: 'dsa', variant: '8w' }],
  decks: {},
  items: Object.fromEntries(ITEMS.map((entry) => [entry.id, entry])),
  coverage: { dsa: { '10w': DSA_10W }, english: { '10w': ENGLISH_10W } },
} as unknown as Catalog

const at = (trackId: string, variant: string, weekNo: number, learners = 1): TrackPosition => ({
  trackId,
  variant,
  week: weekNo,
  learners,
})

// ---------------------------------------------------------------------------------------------

describe('coverageHorizon (decision 25)', () => {
  it('is the highest week among the track variant’s learners, plus two', () => {
    expect(HORIZON_WEEKS).toBe(2)
    const positions = [at('dsa', '10w', 2), at('dsa', '10w', 3, 4), at('dsa', '8w', 6)]
    expect(coverageHorizon(positions, 'dsa', '10w')).toBe(5)
    expect(coverageHorizon(positions, 'dsa', '8w')).toBe(8)
  })

  it('is null without a learner in the last 14 days', () => {
    expect(coverageHorizon([], 'dsa', '10w')).toBeNull()
    expect(coverageHorizon([at('english', '10w', 3)], 'dsa', '10w')).toBeNull()
  })
})

describe('buildContentPage — coverage by week', () => {
  const page = buildContentPage(CATALOG, [at('dsa', '10w', 2), at('dsa', '10w', 3)])
  const dsa = page.tracks.find((entry) => entry.id === 'dsa')!
  const tenWeeks = dsa.roadmaps.find((roadmap) => roadmap.variant === '10w')!

  it('learners at weeks 2 and 3: red rows up to week 5 with a missing lesson or note, none beyond', () => {
    expect(tenWeeks.horizon).toBe(5)
    expect(tenWeeks.maxLearnerWeek).toBe(3)
    expect(tenWeeks.rows?.map((row) => [row.week, row.state])).toEqual([
      [1, 'covered'],
      [2, 'covered'],
      [3, 'covered'],
      [4, 'red'],
      [5, 'red'],
      [6, 'gap'],
      [7, 'gap'],
    ])
  })

  it('counts the learners of each week and names each topic with its lesson or "missing"', () => {
    expect(tenWeeks.rows?.map((row) => row.learners)).toEqual([0, 1, 1, 0, 0, 0, 0])
    expect(tenWeeks.rows?.[0]?.lessons).toEqual([{ topic: 'arrays', title: 'Mảng', present: true }])
    expect(tenWeeks.rows?.[3]?.lessons).toEqual([
      { topic: 'linked-list', title: 'Danh sách liên kết', present: false },
    ])
    expect(tenWeeks.rows?.[3]).toMatchObject({ notedProblems: 0, placedProblems: 8, prompts: 1 })
  })

  it('a week in the horizon with only a missing lesson, or only an unnoted problem, is red', () => {
    const coverage = [
      week(1, { lessons: [{ topic: 'arrays', lessonId: null }] }),
      week(2, { notedProblems: 7 }),
      week(3),
    ]
    const catalog = { ...CATALOG, coverage: { dsa: { '10w': coverage } } } as Catalog
    const rows = buildContentPage(catalog, [at('dsa', '10w', 1)]).tracks[0]!.roadmaps[0]!.rows
    expect(rows?.map((row) => row.state)).toEqual(['red', 'red', 'covered'])
  })

  it('shows the columns of the item types the track lists', () => {
    expect(tenWeeks.columns).toEqual(['lessons', 'notes', 'cards', 'prompts'])
    const english = page.tracks.find((entry) => entry.id === 'english')!.roadmaps[0]!
    expect(english.columns).toEqual(['cards', 'exercises', 'prompts'])
  })

  it('never marks a track red for types it does not list (English topics have no lessons)', () => {
    const english = buildContentPage(CATALOG, [at('english', '10w', 5)]).tracks.find(
      (entry) => entry.id === 'english',
    )!.roadmaps[0]!
    expect(english.horizon).toBe(7)
    expect(english.rows?.every((row) => row.state === 'covered')).toBe(true)
  })

  it('without learners no row is red, and gaps still show', () => {
    const quiet = buildContentPage(CATALOG, []).tracks[0]!.roadmaps[0]!
    expect(quiet.horizon).toBeNull()
    expect(quiet.maxLearnerWeek).toBeNull()
    expect(quiet.rows?.filter((row) => row.state === 'red')).toEqual([])
    expect(quiet.rows?.filter((row) => row.state === 'gap').map((row) => row.week)).toEqual([
      4, 5, 6, 7,
    ])
  })

  it('lists a manifest roadmap without a file, with no rows', () => {
    const eight = dsa.roadmaps.find((roadmap) => roadmap.variant === '8w')!
    expect(eight).toMatchObject({ variantLabel: '8 tuần', rows: null, horizon: null })
    expect(dsa.roadmaps.map((roadmap) => roadmap.variant)).toEqual(['10w', '8w'])
  })

  it('counts the red weeks of every track and variant', () => {
    expect(page.redWeeks).toBe(2)
    expect(buildContentPage(CATALOG, []).redWeeks).toBe(0)
  })
})

describe('buildContentPage — catalog stats and verification', () => {
  const page = buildContentPage(CATALOG, [])
  const dsa = page.tracks.find((entry) => entry.id === 'dsa')!

  it('lists every track, with its title and status', () => {
    expect(page.tracks.map((entry) => [entry.id, entry.title, entry.statusLabel])).toEqual([
      ['dsa', 'Cấu trúc dữ liệu & Giải thuật', 'Đang dùng'],
      ['english', 'Tiếng Anh cho môi trường IT', 'Đang dùng'],
      ['system-design', 'Thiết kế hệ thống', 'Bản nháp'],
    ])
  })

  it('counts items by listed type and status', () => {
    expect(dsa.stats.rows).toEqual([
      { type: 'lesson', label: 'Lesson', active: 1, draft: 1, retired: 0 },
      { type: 'problem', label: 'Problem', active: 3, draft: 1, retired: 1 },
      { type: 'prompt', label: 'Prompt', active: 0, draft: 0, retired: 0 },
      { type: 'flashcard', label: 'Flashcard', active: 0, draft: 0, retired: 0 },
    ])
    expect(page.tracks[1]!.stats.rows.map((row) => [row.type, row.active, row.draft])).toEqual([
      ['flashcard', 1, 1],
      ['exercise', 1, 0],
      ['prompt', 0, 0],
    ])
  })

  it('counts the verification of problem notes (tested, compile-only, none)', () => {
    expect(dsa.stats.verification).toEqual({ tested: 2, compileOnly: 1, noNote: 2 })
    expect(page.tracks[1]!.stats.verification).toBeNull()
  })

  it('marks a track with no item as empty', () => {
    expect(page.tracks[2]!.stats.total).toBe(0)
    expect(dsa.stats.total).toBe(7)
  })
})

describe('buildContentPage — drafts', () => {
  const { drafts } = buildContentPage(CATALOG, [])

  it('lists draft tracks, draft items and draft notes, each with a link', () => {
    expect(drafts.tracks).toEqual([
      { id: 'system-design', title: 'Thiết kế hệ thống', href: '/t/system-design' },
    ])
    expect(drafts.items).toEqual([
      {
        id: 'dsa:lc-0146',
        title: 'LRU Cache',
        titleLang: 'en',
        meta: ['Cấu trúc dữ liệu & Giải thuật', 'Problem'],
        href: '/t/dsa/items/lc-0146',
        target: 'dsa:lc-0146',
        checklist: 'problem',
        verification: null,
        request: null,
      },
      {
        id: 'dsa:lesson-linked-list',
        title: 'Danh sách liên kết',
        titleLang: undefined,
        meta: ['Cấu trúc dữ liệu & Giải thuật', 'Lesson'],
        href: '/t/dsa/items/lesson-linked-list',
        target: 'dsa:lesson-linked-list',
        checklist: 'item',
        verification: null,
        request: null,
      },
      {
        id: 'english:standup:c2',
        title: 'heads-up',
        titleLang: 'en',
        meta: ['Tiếng Anh cho môi trường IT', 'Flashcard'],
        href: '/t/english/items/standup%3Ac2',
        target: 'english:standup:c2',
        checklist: 'item',
        verification: null,
        request: null,
      },
    ])
    expect(drafts.notes).toEqual([
      {
        id: 'dsa:lc-0206#note',
        title: 'Reverse Linked List',
        titleLang: 'en',
        meta: ['Cấu trúc dữ liệu & Giải thuật', 'Ghi chú'],
        href: '/t/dsa/items/lc-0206',
        target: 'dsa:lc-0206#note',
        checklist: 'problem',
        verification: 'tested',
        request: null,
      },
    ])
  })

  it('is empty when nothing is a draft', () => {
    const active = {
      ...CATALOG,
      tracks: [DSA],
      items: { 'dsa:lc-0001': CATALOG.items['dsa:lc-0001'] },
    } as Catalog
    expect(buildContentPage(active, []).drafts).toEqual({ tracks: [], items: [], notes: [] })
  })
})

describe('buildContentPage — publish requests (§6.6, task 6.7a)', () => {
  const PR = 'https://github.com/khanhnguyendev/hoc-deu/pull/41'
  const request = (
    id: number,
    target: string,
    status: PublishRequestRow['status'],
    prUrl: string | null = null,
  ): PublishRequestRow => ({
    id,
    target,
    status,
    prUrl,
    // 02:00 UTC = 09:00 in Viet Nam.
    requestedAt: `2026-10-0${id}T02:00:00Z`,
  })

  it('a draft with a pending request shows it, with its PR once a publish run set one', () => {
    const { drafts } = buildContentPage(
      CATALOG,
      [],
      [
        request(1, 'dsa:lc-0146', 'pending'),
        request(2, 'dsa:lc-0206#note', 'pending', PR),
        request(3, 'dsa:lesson-linked-list', 'cancelled'),
      ],
    )
    expect(drafts.items.find((d) => d.id === 'dsa:lc-0146')?.request).toEqual({
      requestId: 1,
      pr: null,
    })
    expect(drafts.notes[0]?.request).toEqual({
      requestId: 2,
      pr: { href: PR, label: 'PR #41' },
    })
    // A cancelled request is history: the draft can be requested again.
    expect(drafts.items.find((d) => d.id === 'dsa:lesson-linked-list')?.request).toBeNull()
  })

  it('a bot-written draft note reads "tested (bot tests)" (ADR-0040); compile-only stays', () => {
    const bot = (verification: 'tested' | 'compile-only') =>
      ({
        ...CATALOG,
        items: {
          ...CATALOG.items,
          'dsa:lc-0206': item({
            id: 'dsa:lc-0206',
            type: 'problem',
            trackId: 'dsa',
            title: 'Reverse Linked List',
            content: {
              note: { ...note('draft', verification), mdxKey: 'dsa:lc-0206#note', origin: 'bot' },
            } as never,
          }),
        },
      }) as Catalog
    expect(buildContentPage(bot('tested'), []).drafts.notes[0]?.verification).toBe('tested-by-bot')
    expect(buildContentPage(bot('compile-only'), []).drafts.notes[0]?.verification).toBe(
      'compile-only',
    )
  })

  it('lists pending requests first, then the others, newest first, with titles and links', () => {
    const page = buildContentPage(
      CATALOG,
      [],
      [
        request(1, 'dsa:lc-0001#note', 'merged', PR),
        request(2, 'dsa:lc-0206#note', 'pending', PR),
        request(3, 'dsa:lc-0146', 'cancelled'),
        request(4, 'dsa:lc-0146', 'pending'),
        request(5, 'dsa:lc-4242', 'cancelled'),
      ],
    )
    expect(page.publishRequests.state).toBe('ready')
    const rows = page.publishRequests.state === 'ready' ? page.publishRequests.rows : []
    expect(rows.map((row) => [row.id, row.status])).toEqual([
      [4, 'pending'],
      [2, 'pending'],
      [5, 'cancelled'],
      [3, 'cancelled'],
      [1, 'merged'],
    ])
    expect(rows[1]).toEqual({
      id: 2,
      target: 'dsa:lc-0206#note',
      title: 'Reverse Linked List',
      titleLang: 'en',
      kind: 'Ghi chú',
      href: '/t/dsa/items/lc-0206',
      status: 'pending',
      statusLabel: 'Đang chờ',
      pr: { href: PR, label: 'PR #41' },
      requestedAt: '09:00, 2 tháng 10, 2026',
    })
    // A target the deployed catalog no longer has: its ID, no link.
    expect(rows[2]).toMatchObject({ title: 'dsa:lc-4242', href: null, titleLang: undefined })
  })

  it('no request yet: empty; the requests could not be read: error', () => {
    expect(buildContentPage(CATALOG, [], []).publishRequests).toEqual({ state: 'empty' })
    expect(buildContentPage(CATALOG, [], null).publishRequests).toEqual({ state: 'error' })
    expect(buildContentPage(CATALOG, []).publishRequests).toEqual({ state: 'empty' })
  })
})

describe('coverageWarnings (the /admin red warning)', () => {
  it('names each track variant with red weeks, and its weeks', () => {
    expect(coverageWarnings(CATALOG, [at('dsa', '10w', 2), at('dsa', '10w', 3)])).toEqual([
      {
        trackId: 'dsa',
        trackTitle: 'Cấu trúc dữ liệu & Giải thuật',
        variant: '10w',
        weeks: [4, 5],
      },
    ])
  })

  it('is empty without learners, or while their horizon is covered', () => {
    expect(coverageWarnings(CATALOG, [])).toEqual([])
    expect(coverageWarnings(CATALOG, [at('dsa', '10w', 1)])).toEqual([])
    expect(coverageWarnings(CATALOG, [at('english', '10w', 5)])).toEqual([])
  })

  it('ignores positions of a track or variant the catalog does not have', () => {
    expect(coverageWarnings(CATALOG, [at('rust', '10w', 3), at('dsa', '12w', 3)])).toEqual([])
  })
})
