import { beforeEach, describe, expect, it, vi } from 'vitest'
import { contentSignalsResponse } from '@/lib/bot/contract/signals'
import type { Catalog, CatalogItem, WeekCoverage } from '@/lib/content/catalog-types'
import type { TrackManifest } from '@/lib/content/schemas/manifest'
import type { Roadmap } from '@/lib/content/schemas/roadmap'
import { fakeDb, type FakeDb, type Row } from './__fixtures__/fake-db'

const state = vi.hoisted(() => ({
  db: undefined as unknown as FakeDb,
  catalog: undefined as unknown as Catalog,
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db.client }))
vi.mock('@/lib/content/catalog', () => ({ getCatalog: () => state.catalog }))

const { buildContentSignals, contentSignals, signalsAccess, SIGNAL_DAYS } =
  await import('./signals')

// 22:30 UTC on 4 October = 05:30 on 5 October in Viet Nam: today's plan run is run_2026-10-05.
const NOW = new Date('2026-10-04T22:30:00Z')
const RUN_KEY = 'run_2026-10-05'
const PR = 'https://github.com/khanhnguyendev/hoc-deu/pull/41'

// ---------------------------------------------------------------------------------------------
// A small catalog: DSA 10w with five weeks (weeks 1–3 covered, 4–5 without lessons or notes, one
// deep-dive in week 1), English 10w with extended cards in weeks 1–3 only, and the derived deck
// "english:explaining-code" with cards for the noted problems.
// ---------------------------------------------------------------------------------------------

const track = (manifest: Partial<TrackManifest> & Pick<TrackManifest, 'id'>): TrackManifest =>
  ({
    status: 'active',
    title: { vi: manifest.id, en: manifest.id },
    accent: 'track-1',
    topics: [],
    roadmaps: [{ id: '10w', minBudget: 10 }],
    ...manifest,
  }) as unknown as TrackManifest

const DSA = track({ id: 'dsa', itemTypes: ['lesson', 'problem', 'flashcard'] })
const ENGLISH = track({ id: 'english', itemTypes: ['flashcard', 'exercise', 'prompt'] })

const TOPICS = ['arrays', 'two-pointers', 'stack', 'linked-list', 'trees']
/** Week n: two core problems `dsa:lc-<n>01`, `dsa:lc-<n>02`, a recap introduction in week 4. */
const problemsOf = (n: number) => [`dsa:lc-0${n}01`, `dsa:lc-0${n}02`]
const DSA_ROADMAP = {
  id: '10w',
  weeks: TOPICS.map((topic, index) => ({
    week: index + 1,
    topics: [topic],
    core: problemsOf(index + 1),
    bonus: [],
    recap: index === 3 ? [{ item: 'dsa:lc-0901' }, { item: 'dsa:lc-0101', mode: 'redo' }] : [],
    decks: [],
  })),
} as unknown as Roadmap

const covered = (n: number) => n <= 3
const coverage = (n: number, overrides: Partial<WeekCoverage> = {}): WeekCoverage => ({
  week: n,
  topics: [TOPICS[n - 1] ?? 'x'],
  lessons: [{ topic: TOPICS[n - 1] ?? 'x', lessonId: covered(n) ? `dsa:lesson-${n}` : null }],
  placedProblems: 2,
  notedProblems: covered(n) ? 2 : 0,
  bonusProblems: 0,
  notedBonus: 0,
  coreCards: 0,
  extendedCards: 0,
  exercises: 0,
  prompts: 0,
  ...overrides,
})

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

const problem = (id: string, noted: boolean, deepDiveId: string | null = null) =>
  item({
    id,
    type: 'problem',
    trackId: 'dsa',
    title: `Title of ${id}`,
    content: {
      note: noted
        ? {
            status: 'active',
            mdxKey: `${id}#note`,
            verification: 'tested',
            languages: [],
            bilingual: { vi: 'Câu tiếng Việt', en: 'An English line' },
            complexity: { time: 'O(n)', space: 'O(1)' },
            deepDiveId,
          }
        : null,
    },
  } as Partial<CatalogItem> & Pick<CatalogItem, 'id' | 'type' | 'trackId'>)

const derivedCard = (sourceId: string) =>
  item({
    id: `english:explaining-code:${sourceId}`,
    type: 'flashcard',
    trackId: 'english',
    content: { deckId: 'english:explaining-code', derivedFrom: sourceId, tier: 'derived' },
  } as Partial<CatalogItem> & Pick<CatalogItem, 'id' | 'type' | 'trackId'>)

const PROBLEMS = [1, 2, 3, 4, 5]
  .flatMap(problemsOf)
  .concat('dsa:lc-0901')
  .map((id) => problem(id, covered(Number(id.slice(8, 9))), id === 'dsa:lc-0101' ? 'dsa:dd' : null))
const ITEMS = [
  ...PROBLEMS,
  ...PROBLEMS.filter((p) => p.type === 'problem' && covered(Number(p.id.slice(8, 9)))).map((p) =>
    derivedCard(p.id),
  ),
  item({ id: 'english:card-1', type: 'flashcard', trackId: 'english' }),
]

function catalog(): Catalog {
  return {
    schemaVersion: 1,
    tracks: [DSA, ENGLISH],
    roadmaps: { dsa: { '10w': DSA_ROADMAP } },
    missingRoadmaps: [],
    decks: {
      'english:explaining-code': {
        id: 'english:explaining-code',
        trackId: 'english',
        kind: 'derived',
        week: null,
        topicId: null,
        title: { vi: 'Giải thích code', en: 'Explaining code' },
        status: 'active',
        cardIds: ITEMS.filter((i) => i.id.startsWith('english:explaining-code:')).map((i) => i.id),
      },
    },
    items: Object.fromEntries(ITEMS.map((i) => [i.id, i])),
    coverage: {
      dsa: { '10w': [1, 2, 3, 4, 5].map((n) => coverage(n)) },
      english: {
        '10w': [1, 2, 3, 4, 5].map((n) =>
          coverage(n, {
            lessons: [],
            placedProblems: 0,
            notedProblems: 0,
            coreCards: 12,
            extendedCards: n <= 3 ? 10 : 0,
          }),
        ),
      },
    },
  }
}

const results =
  (rows: Row[] = []) =>
  () =>
    rows
const positionsRpc = (rows: Row[]) => () => rows

function setup(
  input: {
    results?: Row[]
    positions?: Row[]
    requests?: Row[]
    runs?: Row[]
    settings?: Partial<Row>
  } = {},
): FakeDb {
  state.catalog = catalog()
  state.db = fakeDb(
    {
      bot_settings: [
        {
          id: true,
          enabled: true,
          dry_run: false,
          content_proposals: true,
          per_run_user_cap: 10,
          limits: {},
          token_hash: null,
          token_prev_hash: null,
          token_prev_valid_until: null,
          ...input.settings,
        },
      ],
      bot_runs: input.runs ?? [
        { id: 'r1', run_key: RUN_KEY, kind: 'plan', ops_date: '2026-10-05', content_pr_url: null },
      ],
      content_publish_requests: input.requests ?? [],
    },
    {
      rpc: {
        content_signal_results: results(input.results),
        bot_track_positions: positionsRpc(input.positions ?? []),
      },
    },
  )
  return state.db
}

const learnersAt = (week: number, trackId = 'dsa', learners = 1): Row => ({
  track_id: trackId,
  variant: '10w',
  week,
  learners,
})

beforeEach(() => {
  setup()
})

describe('buildContentSignals (§6.4.7, decision 19): aggregates only', () => {
  const base = {
    results: [],
    positions: [],
    pendingTargets: [],
    contentPrUrl: null,
  }

  it('highFail: only items at least 5 learners answered, rates to two decimals', () => {
    const signals = buildContentSignals({
      ...base,
      catalog: catalog(),
      results: [
        { itemId: 'dsa:lc-0101', attempts: 14, fails: 6, hints: 3, users: 5 },
        // Four learners: never a signal, whatever the database returned.
        { itemId: 'dsa:lc-0102', attempts: 40, fails: 30, hints: 0, users: 4 },
        { itemId: 'dsa:lc-0201', attempts: 10, fails: 1, hints: 0, users: 9 },
      ],
    })
    expect(signals.highFail).toEqual([
      { itemId: 'dsa:lc-0101', attempts: 14, failRate: 0.43, hintRate: 0.21, hasDeepDive: true },
    ])
  })

  it('highFail: sorted by fail rate, items missing from the catalog and user: items dropped', () => {
    const signals = buildContentSignals({
      ...base,
      catalog: catalog(),
      results: [
        { itemId: 'dsa:lc-0201', attempts: 10, fails: 4, hints: 0, users: 5 },
        { itemId: 'dsa:lc-0202', attempts: 10, fails: 8, hints: 1, users: 6 },
        { itemId: 'dsa:lc-9999', attempts: 10, fails: 9, hints: 0, users: 6 },
        { itemId: 'user:u_abc:x', attempts: 10, fails: 9, hints: 0, users: 6 },
      ],
    })
    expect(signals.highFail.map((signal) => signal.itemId)).toEqual(['dsa:lc-0202', 'dsa:lc-0201'])
    expect(signals.highFail[0]).toMatchObject({ failRate: 0.8, hasDeepDive: false })
  })

  it('missing: a learner at week 3 → weeks 3 to 5 (14 days), lessons and notes, days ahead', () => {
    const signals = buildContentSignals({
      ...base,
      catalog: catalog(),
      positions: [{ trackId: 'dsa', variant: '10w', week: 3, learners: 2 }],
    })
    expect(signals.missing).toEqual([
      { trackId: 'dsa', week: 4, kind: 'lesson', topic: 'linked-list', neededWithinDays: 7 },
      { trackId: 'dsa', week: 4, kind: 'note', itemId: 'dsa:lc-0401', neededWithinDays: 7 },
      { trackId: 'dsa', week: 4, kind: 'note', itemId: 'dsa:lc-0402', neededWithinDays: 7 },
      // The recap entry without a mode introduces a problem: placed, so it counts.
      { trackId: 'dsa', week: 4, kind: 'note', itemId: 'dsa:lc-0901', neededWithinDays: 7 },
      { trackId: 'dsa', week: 5, kind: 'lesson', topic: 'trees', neededWithinDays: 14 },
      { trackId: 'dsa', week: 5, kind: 'note', itemId: 'dsa:lc-0501', neededWithinDays: 14 },
      { trackId: 'dsa', week: 5, kind: 'note', itemId: 'dsa:lc-0502', neededWithinDays: 14 },
    ])
  })

  it('missing: nothing without a learner in the last 14 days; the nearest learner decides', () => {
    expect(buildContentSignals({ ...base, catalog: catalog() }).missing).toEqual([])
    const signals = buildContentSignals({
      ...base,
      catalog: catalog(),
      positions: [
        { trackId: 'dsa', variant: '10w', week: 1, learners: 1 },
        { trackId: 'dsa', variant: '10w', week: 4, learners: 1 },
      ],
    })
    // Week 4 is the second learner's current week: 0 days. Week 5: 7 days (not 28).
    expect(signals.missing.find((m) => m.kind === 'lesson' && m.week === 4)).toMatchObject({
      neededWithinDays: 0,
    })
    expect(signals.missing.find((m) => m.kind === 'lesson' && m.week === 5)).toMatchObject({
      neededWithinDays: 7,
    })
  })

  it('missing: a deep-dive for a high-fail problem learners reach soon, when it has none', () => {
    const signals = buildContentSignals({
      ...base,
      catalog: catalog(),
      results: [
        { itemId: 'dsa:lc-0301', attempts: 10, fails: 6, hints: 0, users: 5 },
        { itemId: 'dsa:lc-0101', attempts: 10, fails: 6, hints: 0, users: 5 },
      ],
      positions: [{ trackId: 'dsa', variant: '10w', week: 3, learners: 1 }],
    })
    expect(signals.missing.filter((m) => m.kind === 'deep-dive')).toEqual([
      { trackId: 'dsa', week: 3, kind: 'deep-dive', itemId: 'dsa:lc-0301', neededWithinDays: 0 },
    ])
  })

  it('englishGaps: English weeks learners reach soon without extended cards', () => {
    const signals = buildContentSignals({
      ...base,
      catalog: catalog(),
      positions: [{ trackId: 'english', variant: '10w', week: 3, learners: 1 }],
    })
    expect(signals.englishGaps).toEqual([
      { week: 4, extendedCards: 0 },
      { week: 5, extendedCards: 0 },
    ])
    // English lists no lessons: a topic without one is not missing.
    expect(signals.missing).toEqual([])
  })

  it('derivedDeckGaps: the placed problems learners reach soon without a derived card', () => {
    const signals = buildContentSignals({
      ...base,
      catalog: catalog(),
      positions: [{ trackId: 'dsa', variant: '10w', week: 2, learners: 1 }],
    })
    expect(signals.derivedDeckGaps).toEqual([
      {
        deckId: 'english:explaining-code',
        missingFor: ['dsa:lc-0401', 'dsa:lc-0402', 'dsa:lc-0901'],
      },
    ])
  })

  it('openProposals: the pending publish targets, then the content PR of today’s plan run', () => {
    const signals = buildContentSignals({
      ...base,
      catalog: catalog(),
      pendingTargets: ['dsa:lc-0401#note', 'dsa:lc-0049'],
      contentPrUrl: PR,
    })
    expect(signals.openProposals).toEqual(['dsa:lc-0049', 'dsa:lc-0401#note', PR])
  })

  it('carries no text: no title, note line or user field anywhere in the answer', () => {
    const signals = buildContentSignals({
      ...base,
      catalog: catalog(),
      results: [{ itemId: 'dsa:lc-0101', attempts: 14, fails: 6, hints: 3, users: 5 }],
      positions: [
        { trackId: 'dsa', variant: '10w', week: 3, learners: 1 },
        { trackId: 'english', variant: '10w', week: 3, learners: 1 },
      ],
    })
    expect(contentSignalsResponse.safeParse(signals).success).toBe(true)
    const json = JSON.stringify(signals)
    for (const text of ['Title of', 'Câu tiếng Việt', 'An English line', 'users', 'learners']) {
      expect(json).not.toContain(text)
    }
  })
})

describe('contentSignals (the secret key)', () => {
  it('reads 90 days of results, the positions, the pending targets and today’s run PR', async () => {
    const db = setup({
      results: [
        { item_id: 'dsa:lc-0101', attempts: 14, fails: 6, hints: 3, users: 5 },
        { item_id: 'dsa:lc-0102', attempts: 14, fails: 6, hints: 3, users: 4 },
      ],
      positions: [learnersAt(3)],
      requests: [
        { id: 1, target: 'dsa:lc-0401#note', status: 'pending', pr_url: null },
        { id: 2, target: 'dsa:lc-0402#note', status: 'merged', pr_url: PR },
        { id: 3, target: 'dsa:lc-0501', status: 'cancelled', pr_url: null },
      ],
      runs: [
        { id: 'r0', run_key: 'run_2026-10-04', kind: 'plan', content_pr_url: `${PR}0` },
        { id: 'r1', run_key: RUN_KEY, kind: 'plan', content_pr_url: PR },
      ],
    })
    const rpcArgs: unknown[] = []
    const original = db.rpc.content_signal_results!
    db.rpc.content_signal_results = (args, fake) => {
      rpcArgs.push(args)
      return original(args, fake)
    }
    const signals = await contentSignals(NOW)
    expect(rpcArgs).toEqual([{ p_days: SIGNAL_DAYS }])
    expect(SIGNAL_DAYS).toBe(90)
    expect(signals.highFail.map((s) => s.itemId)).toEqual(['dsa:lc-0101'])
    expect(signals.missing.length).toBeGreaterThan(0)
    expect(signals.openProposals).toEqual(['dsa:lc-0401#note', PR])
  })
})

describe('signalsAccess (the route’s checks)', () => {
  it('today’s plan run with content proposals on → ok', async () => {
    expect(await signalsAccess(RUN_KEY, NOW)).toBe('ok')
  })

  it('another day’s run, a publish run, an unknown or malformed key → not_found', async () => {
    setup({
      runs: [
        { id: 'r0', run_key: 'run_2026-10-04', kind: 'plan' },
        { id: 'r2', run_key: `${RUN_KEY}_publish-1`, kind: 'publish' },
      ],
    })
    for (const key of ['run_2026-10-04', `${RUN_KEY}_publish-1`, RUN_KEY, 'nope']) {
      expect(await signalsAccess(key, NOW)).toBe('not_found')
    }
  })

  it('content proposals off → content_proposals_off', async () => {
    setup({ settings: { content_proposals: false } })
    expect(await signalsAccess(RUN_KEY, NOW)).toBe('content_proposals_off')
  })
})
