import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = { track_id: string; status: string; roadmap_variant: string; budget_minutes: number }

const fake = vi.hoisted(() => ({
  user: {
    id: 'me',
    isAdmin: false,
    codeLanguage: 'java' as 'python' | 'java' | 'go' | null,
  },
  rows: [] as Row[],
  error: null as { message: string } | null,
  calls: [] as unknown[][],
}))

vi.mock('@/lib/auth/dal', () => ({
  requireOnboarded: async () => {
    fake.calls.push(['requireOnboarded'])
    return fake.user
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    fake.calls.push(['createClient'])
    // A thenable query builder: every filter is recorded and applied to the fake rows.
    const filters: [string, unknown][] = []
    const builder = {
      select(columns: string) {
        fake.calls.push(['select', columns])
        return builder
      },
      eq(column: string, value: unknown) {
        fake.calls.push(['eq', column, value])
        filters.push([column, value])
        return builder
      },
      then(resolve: (result: { data: Row[] | null; error: unknown }) => unknown) {
        const data = fake.rows.filter((row) =>
          filters.every(([column, value]) =>
            column === 'user_id' ? value === fake.user.id : row[column as keyof Row] === value,
          ),
        )
        return Promise.resolve(
          fake.error ? { data: null, error: fake.error } : { data, error: null },
        ).then(resolve)
      },
    }
    return {
      from(table: string) {
        fake.calls.push(['from', table])
        return builder
      },
    }
  },
}))

vi.mock('@/lib/content/catalog', async () => {
  const { FIXTURE_ACCESS } = await import('./fixtures')
  return { catalogAccess: FIXTURE_ACCESS }
})

/** The learner's rows the item page reads through lib/plans and lib/events (task 5.2c). */
const learner = vi.hoisted(() => ({
  today: '2026-10-05',
  enrollments: [] as { trackId: string; status: string }[],
  items: {} as Record<string, unknown>,
  current: null as unknown,
  userItems: [] as unknown[],
  userItemsError: null as Error | null,
}))

vi.mock('@/lib/plans/catalog', async () => {
  const { FIXTURE_CATALOG } = await import('./fixtures')
  const { toPlanCatalog } = await import('@/lib/content/plan-catalog')
  const catalog = toPlanCatalog(FIXTURE_CATALOG)
  // Two Sum II as a Medium problem, so the mock interview has one to pick.
  const medium = { ...catalog.items['dsa:lc-0167']!, difficulty: 'M' as const }
  const planCatalog = { ...catalog, items: { ...catalog.items, 'dsa:lc-0167': medium } }
  return { planCatalog: () => planCatalog }
})

vi.mock('@/lib/plans/reads', () => ({
  readScheduleVersions: async (_supabase: unknown, userId: string) => {
    fake.calls.push(['readScheduleVersions', userId])
    return []
  },
  readEnrollments: async (_supabase: unknown, userId: string) => {
    fake.calls.push(['readPlanEnrollments', userId])
    return learner.enrollments
  },
  readItemStates: async (_supabase: unknown, userId: string) => {
    fake.calls.push(['readItemStates', userId])
    return learner.items
  },
  todayOf: () => learner.today,
  readUserItems: async (_supabase: unknown, userId: string) => {
    fake.calls.push(['readUserItems', userId])
    if (learner.userItemsError !== null) throw learner.userItemsError
    return learner.userItems
  },
}))

vi.mock('@/lib/events/load-derived', () => ({
  loadItemStates: async (_supabase: unknown, userId: string, itemIds: readonly string[]) => {
    fake.calls.push(['loadItemStates', userId, [...itemIds]])
    return Object.fromEntries(
      itemIds.flatMap((id) => (id in learner.items ? [[id, learner.items[id]]] : [])),
    )
  },
}))

vi.mock('@/lib/plans/current', () => ({
  currentPlan: async (
    _supabase: unknown,
    userId: string,
    today: string,
    active: ReadonlySet<string>,
  ) => {
    fake.calls.push(['currentPlan', userId, today, [...active].sort()])
    return learner.current
  },
}))

const { getItemPage, getTrackPage, getTracksOverview } = await import('./queries')

const row = (
  track_id: string,
  status: string,
  roadmap_variant: string,
  budget_minutes: number,
) => ({
  track_id,
  status,
  roadmap_variant,
  budget_minutes,
})

const DSA = {
  id: 'dsa',
  title: 'Cấu trúc dữ liệu & Giải thuật',
  titleEn: 'Data Structures & Algorithms',
  accent: 'track-1',
  status: 'active',
}
const ENGLISH = {
  id: 'english',
  title: 'Tiếng Anh cho môi trường IT',
  titleEn: 'English for IT workplaces',
  accent: 'track-2',
  status: 'active',
}
const LEGACY = {
  id: 'legacy',
  title: 'Lộ trình cũ',
  titleEn: 'Legacy track',
  accent: 'track-4',
  status: 'retired',
}
const SYSDESIGN = {
  id: 'sysdesign',
  title: 'Thiết kế hệ thống',
  titleEn: 'System design',
  accent: 'track-3',
  status: 'draft',
}

beforeEach(() => {
  fake.user = { id: 'me', isAdmin: false, codeLanguage: 'java' }
  fake.rows = []
  fake.error = null
  fake.calls = []
  learner.today = '2026-10-05'
  learner.enrollments = [
    { trackId: 'dsa', status: 'active' },
    { trackId: 'english', status: 'paused' },
  ]
  learner.items = {}
  learner.current = null
  learner.userItems = []
  learner.userItemsError = null
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** An `item_state` row as the engine reads it (lib/domain/state). */
function stateOf(itemId: string, patch: Record<string, unknown> = {}) {
  return {
    itemId,
    trackId: itemId.split(':')[0],
    topicId: null,
    itemType: 'problem',
    level: 1,
    weak: false,
    topSuccesses: 0,
    status: 'ok',
    dueOn: '2026-10-05',
    lastResult: 'solved',
    lastResultOn: '2026-09-28',
    introducedOn: '2026-09-28',
    lapses: 0,
    reps: 1,
    ...patch,
  }
}

/** A stored plan of `kind` whose blocks list the given `[blockId, itemId, mode]` entries. */
function currentWith(kind: string, blocks: [string, string, string][]) {
  return {
    kind,
    blocks: {},
    plan: {
      id: 'plan-1',
      planDate: '2026-10-05',
      version: 1,
      source: 'baseline',
      seenAt: null,
      tracks: {},
      blocks: blocks.map(([id, itemId, mode]) => ({
        id,
        trackId: 'dsa',
        kind: 'review',
        estMinutes: 5,
        items: [{ itemId, mode, minutes: 5 }],
      })),
    },
  }
}

describe('getTracksOverview', () => {
  it('guards first, then reads the learner’s own user_tracks rows with the session client', async () => {
    await getTracksOverview()
    expect(fake.calls).toEqual([
      ['requireOnboarded'],
      ['createClient'],
      ['from', 'user_tracks'],
      ['select', 'track_id, status, roadmap_variant, budget_minutes'],
      ['eq', 'user_id', 'me'],
    ])
  })

  it('lists active and paused enrollments as mine, in catalog order — a retired track included', async () => {
    fake.rows = [
      row('english', 'paused', '10w', 25),
      row('dsa', 'active', '8w', 60),
      row('legacy', 'active', '4w', 30),
    ]
    await expect(getTracksOverview()).resolves.toEqual({
      isAdmin: false,
      mine: [
        { track: DSA, enrollment: { status: 'active', roadmapVariant: '8w', budgetMinutes: 60 } },
        {
          track: ENGLISH,
          enrollment: { status: 'paused', roadmapVariant: '10w', budgetMinutes: 25 },
        },
        {
          track: LEGACY,
          enrollment: { status: 'active', roadmapVariant: '4w', budgetMinutes: 30 },
        },
      ],
      others: [],
    })
  })

  it('offers active tracks not enrolled (or removed) as others; never retired or draft ones', async () => {
    fake.rows = [row('english', 'removed', '10w', 25), row('gone', 'active', '8w', 60)]
    const overview = await getTracksOverview()
    expect(overview.mine).toEqual([])
    expect(overview.others).toEqual([DSA, ENGLISH])
  })

  it('shows draft tracks to admins', async () => {
    fake.user = { ...fake.user, isAdmin: true }
    const overview = await getTracksOverview()
    expect(overview.isAdmin).toBe(true)
    expect(overview.others).toEqual([DSA, ENGLISH, SYSDESIGN])
  })

  it('reads an unknown status as removed (not shown as mine)', async () => {
    fake.rows = [row('dsa', 'archived', '8w', 60)]
    const overview = await getTracksOverview()
    expect(overview.mine).toEqual([])
    expect(overview.others).toEqual([DSA, ENGLISH])
  })

  it('throws on a read error, so the error boundary offers "Thử lại"', async () => {
    fake.error = { message: 'boom' }
    await expect(getTracksOverview()).rejects.toThrow()
  })
})

describe('getTrackPage', () => {
  it('guards first; an unknown track is null without a database read', async () => {
    await expect(getTrackPage('nope', undefined)).resolves.toBeNull()
    expect(fake.calls).toEqual([['requireOnboarded']])
  })

  it('reads only this track’s row of the learner', async () => {
    await getTrackPage('dsa', undefined)
    expect(fake.calls.slice(0, 6)).toEqual([
      ['requireOnboarded'],
      ['createClient'],
      ['from', 'user_tracks'],
      ['select', 'track_id, status, roadmap_variant, budget_minutes'],
      ['eq', 'user_id', 'me'],
      ['eq', 'track_id', 'dsa'],
    ])
  })

  it('hides a draft track from a learner and shows it to an admin', async () => {
    await expect(getTrackPage('sysdesign', undefined)).resolves.toBeNull()
    fake.user = { ...fake.user, isAdmin: true }
    const page = await getTrackPage('sysdesign', undefined)
    expect(page?.track).toEqual(SYSDESIGN)
    expect(page?.isAdmin).toBe(true)
  })

  it('shows a retired track only to its enrolled learners (and admins)', async () => {
    await expect(getTrackPage('legacy', undefined)).resolves.toBeNull()
    fake.rows = [row('legacy', 'removed', '4w', 30)]
    await expect(getTrackPage('legacy', undefined)).resolves.toBeNull()
    fake.rows = [row('legacy', 'paused', '4w', 30)]
    const page = await getTrackPage('legacy', undefined)
    expect(page?.track).toEqual(LEGACY)
    expect(page?.enrollment).toEqual({ status: 'paused', roadmapVariant: '4w', budgetMinutes: 30 })
    fake.rows = []
    fake.user = { ...fake.user, isAdmin: true }
    expect((await getTrackPage('legacy', undefined))?.track).toEqual(LEGACY)
  })

  it('picks the variant: the parameter, else the enrolled one, else the budget default (2.9)', async () => {
    const current = async (variant: string | undefined) =>
      (await getTrackPage('dsa', variant))?.variants.find((v) => v.current)?.id
    // No enrollment: defaultVariant(roadmaps, 60 min) → 8w (recommended below 75).
    expect(await current(undefined)).toBe('8w')
    expect(await current('nope')).toBe('8w')
    expect(await current('10w')).toBe('10w')
    fake.rows = [row('dsa', 'active', '10w', 90)]
    expect(await current(undefined)).toBe('10w')
    expect(await current('nope')).toBe('10w')
    expect(await current('8w')).toBe('8w')
    // A stale enrolled variant the manifest no longer lists falls back to the default.
    fake.rows = [row('dsa', 'active', '12w', 90)]
    expect(await current(undefined)).toBe('8w')
    // A removed enrollment does not count.
    fake.rows = [row('dsa', 'removed', '10w', 90)]
    expect(await current(undefined)).toBe('8w')
  })

  it('links every manifest roadmap by label, marking the current one', async () => {
    const page = await getTrackPage('dsa', '10w')
    expect(page?.variants).toEqual([
      { id: '8w', label: '8 tuần', href: '/t/dsa?variant=8w', current: false },
      { id: '10w', label: '10 tuần', href: '/t/dsa?variant=10w', current: true },
    ])
  })

  it('builds the view of an existing roadmap file; a missing one is view: null (decision 4)', async () => {
    fake.rows = [row('dsa', 'active', '8w', 60)]
    const page = await getTrackPage('dsa', undefined)
    expect(page?.view?.variant).toBe('8w')
    expect(page?.view?.weeks.map((week) => week.week)).toEqual([1, 2, 3])
    expect(page?.enrollment).toEqual({ status: 'active', roadmapVariant: '8w', budgetMinutes: 60 })
    expect(page?.isAdmin).toBe(false)
    await expect(getTrackPage('dsa', '10w')).resolves.toMatchObject({ view: null })
  })

  it('includes drafts in the view for admins only', async () => {
    const coreOf = async () =>
      (await getTrackPage('dsa', '8w'))?.view?.weeks[0]?.core.map((item) => item.id)
    expect(await coreOf()).toEqual(['dsa:lc-0001', 'dsa:lc-0167'])
    fake.user = { ...fake.user, isAdmin: true }
    expect(await coreOf()).toEqual(['dsa:lc-0001', 'dsa:lc-0217', 'dsa:lc-0167'])
  })

  it('task 5.4: reads the learner’s item states, then their progress, Weak items and row states', async () => {
    fake.rows = [row('dsa', 'active', '8w', 60)]
    learner.items = {
      'dsa:lc-0001': stateOf('dsa:lc-0001', { status: 'weak', weak: true }),
      'dsa:lc-0167': stateOf('dsa:lc-0167', { status: 'strong' }),
      'english:w01-blocker': stateOf('english:w01-blocker', { trackId: 'english' }),
    }
    const page = await getTrackPage('dsa', undefined)
    expect(fake.calls).toContainEqual(['readItemStates', 'me'])
    expect(page?.progress).toEqual({ week: 2, weeks: 3, introduced: 2, total: 3 })
    expect(page?.weakItems.map((item) => item.id)).toEqual(['dsa:lc-0001'])
    // The rows' states: this track's items only, as ItemStateView.
    expect(page?.states).toEqual({
      'dsa:lc-0001': { status: 'weak', level: 1, dueOn: '2026-10-05' },
      'dsa:lc-0167': { status: 'strong', level: 1, dueOn: '2026-10-05' },
    })
    expect(page?.requestId).toMatch(UUID)
  })

  it('task 5.4: progress on the enrolled variant, whichever variant the page shows', async () => {
    fake.rows = [row('dsa', 'paused', '8w', 60)]
    learner.items = { 'dsa:lc-0001': stateOf('dsa:lc-0001') }
    const page = await getTrackPage('dsa', '10w')
    expect(page?.view).toBeNull()
    expect(page?.progress).toEqual({ week: 1, weeks: 3, introduced: 1, total: 3 })
  })

  it('task 5.4: no progress or Weak items without an active or paused enrollment', async () => {
    learner.items = { 'dsa:lc-0001': stateOf('dsa:lc-0001', { status: 'weak', weak: true }) }
    for (const rows of [[], [row('dsa', 'removed', '8w', 60)]]) {
      fake.rows = rows
      const page = await getTrackPage('dsa', undefined)
      expect(page?.progress).toBeNull()
      expect(page?.weakItems).toEqual([])
      // The rows still show what the learner did (history is kept, §5.9).
      expect(page?.states['dsa:lc-0001']?.status).toBe('weak')
    }
  })

  it('task 5.4: a Weak draft item is listed for an admin only (as the roadmap)', async () => {
    fake.rows = [row('dsa', 'active', '8w', 60)]
    learner.items = {
      'dsa:lc-0217': stateOf('dsa:lc-0217', { status: 'weak', weak: true }),
      'dsa:lc-0015': stateOf('dsa:lc-0015', { status: 'weak', weak: true }),
    }
    expect((await getTrackPage('dsa', undefined))?.weakItems).toEqual([])
    fake.user = { ...fake.user, isAdmin: true }
    expect((await getTrackPage('dsa', undefined))?.weakItems.map((item) => item.id)).toEqual([
      'dsa:lc-0217',
    ])
  })

  it('task 5.4 (M3 residual): the derived deck counts the cards this learner unlocked', async () => {
    const unlocked = async () =>
      (await getTrackPage('english', undefined))?.view?.anytime.derivedDecks.map(
        (deck) => deck.unlocked,
      )
    expect(await unlocked()).toEqual([0])
    learner.items = { 'dsa:lc-0001': stateOf('dsa:lc-0001') }
    expect(await unlocked()).toEqual([1])
  })

  it('describes the weekly template and throttle as Vietnamese text', async () => {
    const dsa = await getTrackPage('dsa', undefined)
    expect(dsa?.template).toEqual([
      { label: 'Thứ 2 – Thứ 6', blocks: ['Ôn tập (tối đa 15 phút)', 'Bài mới'] },
      { label: 'Thứ 7', blocks: ['Ôn tập'] },
    ])
    expect(dsa?.throttle).toEqual([])
    const english = await getTrackPage('english', undefined)
    expect(english?.throttle).toEqual([
      'Tối đa 8 thẻ mới mỗi ngày',
      'Trên 40 thẻ cần ôn: 4 thẻ mới mỗi ngày',
    ])
    expect(english?.enrollment).toBeNull()
  })
})

describe('getItemPage', () => {
  it('guards first; an unknown item reads nothing', async () => {
    await getItemPage('dsa', 'lc-99999')
    expect(fake.calls).toEqual([['requireOnboarded']])
  })

  it('returns the item, its track, the viewer and the back link', async () => {
    const model = await getItemPage('dsa', 'lc-0001')
    expect(model?.item.id).toBe('dsa:lc-0001')
    expect(model?.track).toEqual(DSA)
    expect(model?.viewer).toEqual({ codeLanguage: 'java', isAdmin: false })
    expect(model?.backHref).toBe('/t/dsa')
    expect(model).not.toHaveProperty('data')
  })

  it('falls back to the track’s first code language when the learner has none', async () => {
    fake.user = { ...fake.user, codeLanguage: null }
    expect((await getItemPage('dsa', 'lc-0001'))?.viewer.codeLanguage).toBe('python')
    expect((await getItemPage('english', 'ex-w01-fill-1'))?.viewer.codeLanguage).toBe('python')
  })

  it('decodes a derived card ID from the route (encoded or not)', async () => {
    const encoded = await getItemPage('english', 'explaining-code%3Adsa%3Alc-0001')
    expect(encoded?.item.id).toBe('english:explaining-code:dsa:lc-0001')
    const raw = await getItemPage('english', 'explaining-code:dsa:lc-0001')
    expect(raw?.item.id).toBe('english:explaining-code:dsa:lc-0001')
  })

  it('is null for an unknown item or track, and for another track’s item', async () => {
    await expect(getItemPage('dsa', 'lc-99999')).resolves.toBeNull()
    await expect(getItemPage('nope', 'lc-0001')).resolves.toBeNull()
    await expect(getItemPage('english', 'lc-0001')).resolves.toBeNull()
    await expect(getItemPage('dsa', '%E0%A4%A')).resolves.toBeNull()
  })

  it('hides a draft item and a draft track’s items from learners; admins see both', async () => {
    await expect(getItemPage('dsa', 'lc-0217')).resolves.toBeNull()
    await expect(getItemPage('sysdesign', 'prompt-intro')).resolves.toBeNull()
    fake.user = { ...fake.user, isAdmin: true }
    expect((await getItemPage('dsa', 'lc-0217'))?.item.status).toBe('draft')
    expect((await getItemPage('sysdesign', 'prompt-intro'))?.track).toEqual(SYSDESIGN)
  })

  it('keeps a retired item viewable (its page shows the notice)', async () => {
    expect((await getItemPage('dsa', 'lc-0015'))?.item.status).toBe('retired')
  })

  it('links back to /tracks, not a 404, from a retired track the learner does not follow', async () => {
    // The retired track's page is a 404 for this learner (getTrackPage), so the item links to /tracks.
    const stranger = await getItemPage('legacy', 'prompt-legacy-drill')
    expect(stranger?.item.id).toBe('legacy:prompt-legacy-drill')
    expect(stranger?.backHref).toBe('/tracks')
    await expect(getTrackPage('legacy', undefined)).resolves.toBeNull()
    // Only this track's own row is read, and only for a retired track.
    expect(fake.calls.filter((call) => call[0] === 'eq')).toContainEqual([
      'eq',
      'track_id',
      'legacy',
    ])

    for (const status of ['active', 'paused']) {
      fake.rows = [row('legacy', status, '4w', 30)]
      expect((await getItemPage('legacy', 'prompt-legacy-drill'))?.backHref, status).toBe(
        '/t/legacy',
      )
    }
    fake.rows = [row('legacy', 'removed', '4w', 30)]
    expect((await getItemPage('legacy', 'prompt-legacy-drill'))?.backHref).toBe('/tracks')

    // An admin sees the retired track's page, so the link goes there.
    fake.rows = []
    fake.user = { ...fake.user, isAdmin: true }
    expect((await getItemPage('legacy', 'prompt-legacy-drill'))?.backHref).toBe('/t/legacy')
  })

  it('resolves links like the page’s viewer: drafts for admins only', async () => {
    const learner = await getItemPage('dsa', 'lc-0001')
    expect(learner?.resolveItem('dsa:lc-0167')?.href).toBe('/t/dsa/items/lc-0167')
    expect(learner?.resolveItem('dsa:lc-0217')).toBeNull()
    expect(learner?.resolveItem('sysdesign:prompt-intro')).toBeNull()
    fake.user = { ...fake.user, isAdmin: true }
    const admin = await getItemPage('dsa', 'lc-0001')
    expect(admin?.resolveItem('dsa:lc-0217')?.id).toBe('dsa:lc-0217')
    expect(admin?.resolveItem('sysdesign:prompt-intro')?.id).toBe('sysdesign:prompt-intro')
  })
})

describe('getItemPage — the learner’s results context (task 5.2c)', () => {
  it('reads the schedule, the enrollments, the item’s own state and the current plan', async () => {
    await getItemPage('dsa', 'lc-0001')
    expect(fake.calls[0]).toEqual(['requireOnboarded'])
    expect(fake.calls).toContainEqual(['loadItemStates', 'me', ['dsa:lc-0001']])
    expect(fake.calls).toContainEqual(['readScheduleVersions', 'me'])
    expect(fake.calls).toContainEqual(['readPlanEnrollments', 'me'])
    // Only active tracks: the current plan is the one /today shows (decision 13, M-5 A).
    expect(fake.calls).toContainEqual(['currentPlan', 'me', '2026-10-05', ['dsa']])
    // Never every item state, except for the mock interview.
    expect(fake.calls.some((call) => call[0] === 'readItemStates')).toBe(false)
  })

  it('returns the state, the resolved mode, the plan context and a per-render request id', async () => {
    learner.items = { 'dsa:lc-0001': stateOf('dsa:lc-0001') }
    learner.current = currentWith('today', [['2026-10-05:dsa:review:1', 'dsa:lc-0001', 'recall']])
    const model = await getItemPage('dsa', 'lc-0001')
    const view = { status: 'ok', level: 1, dueOn: '2026-10-05' }
    expect(model?.state).toEqual(view)
    expect(model?.outcome).toEqual({
      mode: 'recall',
      plan: { blockId: '2026-10-05:dsa:review:1', label: 'Trong kế hoạch hôm nay' },
      state: view,
      due: true,
      requestId: expect.stringMatching(UUID),
      itemId: 'dsa:lc-0001',
      blockId: '2026-10-05:dsa:review:1',
    })
    expect(model).not.toHaveProperty('mockInterviewProblem')
    const again = await getItemPage('dsa', 'lc-0001')
    expect(again?.outcome?.requestId).not.toBe(model?.outcome?.requestId)
  })

  it('?block= chooses among the blocks listing the item; an unknown one falls back to the first', async () => {
    learner.current = currentWith('today', [
      ['b-new', 'dsa:lc-0001', 'new'],
      ['b-recap', 'dsa:lc-0001', 'redo'],
    ])
    const recap = await getItemPage('dsa', 'lc-0001', 'b-recap')
    expect(recap?.outcome).toMatchObject({ blockId: 'b-recap', mode: 'redo' })
    const unknown = await getItemPage('dsa', 'lc-0001', 'b-gone')
    expect(unknown?.outcome).toMatchObject({ blockId: 'b-new', mode: 'new' })
  })

  it('opened from a plan (?block=, the item in the current plan): the back link is /today (m-9)', async () => {
    learner.current = currentWith('today', [['b-new', 'dsa:lc-0001', 'new']])
    expect((await getItemPage('dsa', 'lc-0001', 'b-new'))?.backHref).toBe('/today')
    // A stale ?block= of an item still in the plan: the plan is still where it came from.
    expect((await getItemPage('dsa', 'lc-0001', 'b-gone'))?.backHref).toBe('/today')
    // Without ?block= (from the track page, /review): its track.
    expect((await getItemPage('dsa', 'lc-0001'))?.backHref).toBe('/t/dsa')
    // ?block= of an item no longer in the current plan: its track.
    learner.current = currentWith('today', [['b-other', 'dsa:lc-0167', 'new']])
    expect((await getItemPage('dsa', 'lc-0001', 'b-new'))?.backHref).toBe('/t/dsa')
  })

  it('a valid ?mode= wins; an invalid one is ignored', async () => {
    learner.current = currentWith('today', [['b-new', 'dsa:lc-0001', 'new']])
    expect((await getItemPage('dsa', 'lc-0001', undefined, 'redo'))?.outcome?.mode).toBe('redo')
    expect((await getItemPage('dsa', 'lc-0001', undefined, 'review'))?.outcome?.mode).toBe('new')
  })

  it('off the plan: no plan context and no block; not studied yet: no state, mode new, not due', async () => {
    learner.current = currentWith('today', [['b-other', 'dsa:lc-0167', 'new']])
    const model = await getItemPage('dsa', 'lc-0001')
    expect(model?.state).toBeNull()
    expect(model?.outcome).toMatchObject({ plan: null, state: null, mode: 'new', due: false })
    expect(model?.outcome).not.toHaveProperty('blockId')
  })

  it('the paused (or resumed) plan reads "Trong kế hoạch đang dở"', async () => {
    learner.current = currentWith('paused', [['b-new', 'dsa:lc-0001', 'new']])
    expect((await getItemPage('dsa', 'lc-0001'))?.outcome?.plan?.label).toBe(
      'Trong kế hoạch đang dở',
    )
    learner.current = currentWith('resumed', [['b-new', 'dsa:lc-0001', 'new']])
    expect((await getItemPage('dsa', 'lc-0001'))?.outcome?.plan?.label).toBe(
      'Trong kế hoạch đang dở',
    )
  })

  it('read-only — no outcome, no state, no learner reads — for drafts, retired items and tracks', async () => {
    fake.user = { ...fake.user, isAdmin: true }
    for (const [track, item] of [
      ['dsa', 'lc-0217'], // a draft item (admin preview)
      ['dsa', 'lc-0015'], // a retired item
      ['sysdesign', 'prompt-intro'], // an active item of a draft track (admin preview)
      ['legacy', 'prompt-legacy-drill'], // an active item of a retired track
    ]) {
      fake.calls = []
      const model = await getItemPage(track!, item!)
      expect(model?.outcome, item).toBeNull()
      expect(model?.state, item).toBeNull()
      expect(
        fake.calls.filter((call) => call[0] === 'currentPlan' || call[0] === 'loadItemStates'),
      ).toEqual([])
    }
  })

  it('the mock-interview prompt: every item state, and the Medium problem mockInterviewProblem picks', async () => {
    learner.items = {
      'dsa:lc-0167': stateOf('dsa:lc-0167', { lastResultOn: '2026-09-20' }),
      'dsa:lc-0001': stateOf('dsa:lc-0001'),
    }
    const model = await getItemPage('dsa', 'prompt-mock-interview')
    expect(fake.calls).toContainEqual(['readItemStates', 'me'])
    expect(fake.calls.some((call) => call[0] === 'loadItemStates')).toBe(false)
    expect(model?.mockInterviewProblem).toMatchObject({
      id: 'dsa:lc-0167',
      href: '/t/dsa/items/lc-0167',
    })
    expect(model?.outcome).toMatchObject({ itemId: 'dsa:prompt-mock-interview', mode: 'new' })
  })

  it('…null when no Medium problem is learned yet', async () => {
    learner.items = { 'dsa:lc-0001': stateOf('dsa:lc-0001') }
    expect((await getItemPage('dsa', 'prompt-mock-interview'))?.mockInterviewProblem).toBeNull()
  })
})

// ---------------------------------------------------------------------------------------------
// Custom items (task 6.6a): the "Mục riêng" tab and the user: item page (decisions 17, 39)
// ---------------------------------------------------------------------------------------------

const CARD_ID = 'user:0123456789abcdef:standup-card'
/** A stored custom card of the English track (the fixture manifest has card estimates). */
function customRow(itemId: string, change: Record<string, unknown> = {}) {
  return {
    itemId,
    itemType: 'flashcard',
    trackId: 'english',
    topicId: 'standup',
    payload: { front: 'blocker', back: 'vướng mắc', tags: [] },
    status: 'active',
    createdOn: '2026-10-01',
    ...change,
  }
}

describe('getTrackPage — the "Mục riêng" tab (§2.4)', () => {
  it('is null for a learner without custom items of the track', async () => {
    learner.userItems = [customRow('user:0123456789abcdef:dsa-card', { trackId: 'dsa' })]
    const data = await getTrackPage('english', undefined)
    expect(data?.customItems).toBeNull()
    expect(fake.calls).toContainEqual(['readUserItems', 'me'])
  })

  it('lists the track’s active items, then the hidden ones; retired ones are not listed', async () => {
    learner.userItems = [
      customRow('user:0123456789abcdef:b-hidden', { status: 'hidden' }),
      customRow('user:0123456789abcdef:a-active'),
      customRow('user:0123456789abcdef:c-retired', { status: 'retired' }),
      customRow('user:0123456789abcdef:z-active'),
    ]
    const data = await getTrackPage('english', undefined)
    expect(data?.customItems).toEqual({
      state: 'ready',
      items: [
        { item: expect.objectContaining({ id: 'user:0123456789abcdef:a-active' }), hidden: false },
        { item: expect.objectContaining({ id: 'user:0123456789abcdef:z-active' }), hidden: false },
        { item: expect.objectContaining({ id: 'user:0123456789abcdef:b-hidden' }), hidden: true },
      ],
    })
  })

  it('whatever the AI flag: the tab reads the rows the learner has (§5.12)', async () => {
    learner.userItems = [customRow(CARD_ID)]
    expect((await getTrackPage('english', undefined))?.customItems).toMatchObject({
      state: 'ready',
    })
  })

  it('a failed read is the tab’s error state, never the page’s', async () => {
    learner.userItemsError = new Error('boom')
    const data = await getTrackPage('english', undefined)
    expect(data?.customItems).toEqual({ state: 'error' })
    expect(data?.track).toEqual(ENGLISH)
  })
})

describe('getItemPage — a custom item (decision 39)', () => {
  const param = encodeURIComponent(CARD_ID)

  it('renders the learner’s own item from its encoded ID, with the results context', async () => {
    learner.userItems = [customRow(CARD_ID)]
    learner.enrollments = [{ trackId: 'english', status: 'active' }]
    const model = await getItemPage('english', param)
    expect(model?.item).toMatchObject({ id: CARD_ID, type: 'flashcard', title: 'blocker' })
    expect(model?.custom).toBe(true)
    expect(model?.backHref).toBe('/t/english')
    expect(model?.outcome).toMatchObject({ mode: 'new', itemId: CARD_ID, plan: null })
    expect((await getItemPage('english', CARD_ID))?.item.id).toBe(CARD_ID)
  })

  it('a repository item is not custom', async () => {
    expect((await getItemPage('dsa', 'lc-0001'))?.custom).toBe(false)
  })

  it('is null for an ID the learner does not own (RLS: another learner’s is not read)', async () => {
    learner.userItems = []
    expect(await getItemPage('english', param)).toBeNull()
  })

  it('is null under another track than the item’s', async () => {
    learner.userItems = [customRow(CARD_ID)]
    expect(await getItemPage('dsa', param)).toBeNull()
  })

  it('a hidden item stays readable, read-only', async () => {
    learner.userItems = [customRow(CARD_ID, { status: 'hidden' })]
    learner.enrollments = [{ trackId: 'english', status: 'active' }]
    const model = await getItemPage('english', param)
    expect(model?.item.status).toBe('retired')
    expect(model?.outcome).toBeNull()
  })
})
