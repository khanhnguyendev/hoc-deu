import { beforeEach, describe, expect, it, vi } from 'vitest'

type Response = { data: unknown; error: { message: string } | null }

const fake = vi.hoisted(() => ({
  admin: true,
  /** The answer of an RPC not listed in `rpcs`. */
  rpc: { data: [], error: null } as Response,
  rpcs: {} as Record<string, Response>,
  /** The latest ops_metrics row per key (`maybeSingle`), or an error. */
  metrics: {} as Record<string, Response>,
  calls: [] as unknown[][],
}))

vi.mock('@/lib/auth/dal', () => ({
  requireAdmin: async () => {
    fake.calls.push(['requireAdmin'])
    if (!fake.admin) throw new Error('NOT_FOUND')
    return { id: 'me' }
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: async (name: string) => {
      fake.calls.push(['rpc', name])
      return fake.rpcs[name] ?? fake.rpc
    },
    from: (table: string) => {
      const query: string[] = [table]
      let key = ''
      const chain = {
        select: (columns: string) => (query.push(`select ${columns}`), chain),
        eq: (column: string, value: string) => (
          (key = value),
          query.push(`${column}=${value}`),
          chain
        ),
        order: (column: string, options: { ascending: boolean }) => (
          query.push(`order ${column} ${options.ascending ? 'asc' : 'desc'}`),
          chain
        ),
        limit: (n: number) => (query.push(`limit ${n}`), chain),
        maybeSingle: async () => {
          fake.calls.push(['from', ...query])
          return fake.metrics[key] ?? { data: null, error: null }
        },
      }
      return chain
    },
  }),
}))
vi.mock('@/lib/content/catalog', () => ({ getCatalog: () => CATALOG }))

const CATALOG = vi.hoisted(() => ({
  schemaVersion: 1,
  tracks: [
    {
      id: 'dsa',
      status: 'active',
      title: { vi: 'Cấu trúc dữ liệu & Giải thuật', en: 'DSA' },
      itemTypes: ['lesson', 'problem'],
      topics: [],
      roadmaps: [{ id: '10w' }],
    },
  ],
  roadmaps: {},
  missingRoadmaps: [],
  decks: {},
  items: {},
  coverage: {
    dsa: {
      '10w': [1, 2, 3, 4, 5, 6].map((week) => ({
        week,
        topics: ['t'],
        lessons: [{ topic: 't', lessonId: week <= 3 ? `dsa:lesson-${week}` : null }],
        placedProblems: 2,
        notedProblems: week <= 3 ? 2 : 0,
        bonusProblems: 0,
        notedBonus: 0,
        coreCards: 0,
        extendedCards: 0,
        exercises: 0,
        prompts: 0,
      })),
    },
  },
}))

const { getAdminContent, getAdminOverview, listUsers } = await import('./queries')

const dbRow = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  email: `${id}@example.test`,
  display_name: `Người ${id}`,
  avatar_url: null,
  role: 'learner',
  status: 'active',
  created_at: '2026-01-10T03:00:00+00:00',
  approved_at: '2026-01-11T03:00:00+00:00',
  onboarded_at: null,
  ...overrides,
})

beforeEach(() => {
  fake.admin = true
  fake.rpc = { data: [], error: null }
  fake.rpcs = {}
  fake.metrics = {}
  fake.calls = []
})

describe('listUsers', () => {
  it('reads admin_list_users as the admin and keeps its order, marking the admin’s own row', async () => {
    fake.rpc = {
      data: [
        dbRow('p1', { status: 'pending', approved_at: null, display_name: null }),
        dbRow('me', { role: 'admin' }),
      ],
      error: null,
    }
    await expect(listUsers()).resolves.toEqual([
      {
        id: 'p1',
        email: 'p1@example.test',
        displayName: null,
        role: 'learner',
        status: 'pending',
        createdAt: '2026-01-10T03:00:00+00:00',
        approvedAt: null,
        onboardedAt: null,
        isSelf: false,
      },
      {
        id: 'me',
        email: 'me@example.test',
        displayName: 'Người me',
        role: 'admin',
        status: 'active',
        createdAt: '2026-01-10T03:00:00+00:00',
        approvedAt: '2026-01-11T03:00:00+00:00',
        onboardedAt: null,
        isSelf: true,
      },
    ])
    expect(fake.calls).toEqual([['requireAdmin'], ['rpc', 'admin_list_users']])
  })

  it('refuses a non-admin before touching the database', async () => {
    fake.admin = false
    await expect(listUsers()).rejects.toThrow('NOT_FOUND')
    expect(fake.calls).toEqual([['requireAdmin']])
  })

  it('throws on an RPC error, so the route’s error boundary shows "Thử lại"', async () => {
    fake.rpc = { data: null, error: { message: 'forbidden' } }
    await expect(listUsers()).rejects.toThrow()
  })
})

const OVERVIEW = {
  users: { pending: 2, active: 7, suspended: 1, rejected: 0 },
  learners_completed_7d: 4,
  plans_created_7d: 21,
}
const POSITIONS = [
  { track_id: 'dsa', variant: '10w', week: 2, learners: 3 },
  { track_id: 'dsa', variant: '10w', week: 3, learners: 1 },
]

describe('getAdminOverview', () => {
  it('reads the aggregates and the latest row of each metric, as the admin', async () => {
    fake.rpcs = {
      admin_overview: { data: OVERVIEW, error: null },
      admin_track_positions: { data: POSITIONS, error: null },
    }
    fake.metrics = {
      'db.size_bytes': {
        data: { value: 360 * 1024 * 1024, recorded_at: new Date().toISOString() },
        error: null,
      },
    }
    const page = await getAdminOverview()

    expect(fake.calls[0]).toEqual(['requireAdmin'])
    expect(fake.calls.slice(1)).toEqual(
      expect.arrayContaining([
        ['rpc', 'admin_overview'],
        ['rpc', 'admin_track_positions'],
        ...[
          'db.size_bytes',
          'backup.last_success_at',
          'restore_test.last_success_at',
          'cron.last_run_at',
        ].map((key) => [
          'from',
          'ops_metrics',
          'select value, recorded_at',
          `key=${key}`,
          'order recorded_at desc',
          'limit 1',
        ]),
      ]),
    )
    expect(fake.calls).toHaveLength(7)
    expect(page.counts).toEqual({
      users: { pending: 2, active: 7, suspended: 1, rejected: 0 },
      learnersCompleted7d: 4,
      plansCreated7d: 21,
    })
    // Learners up to week 3 of DSA 10w: weeks 4 and 5 lack their lesson and notes.
    expect(page.warnings.map((warning) => warning.kind)).toEqual(['coverage', 'db-size'])
    expect(page.warnings[0]?.message).toContain('tuần 4, 5')
    expect(page.system.map((card) => card.value)).toEqual([
      '360 MB',
      'chưa có dữ liệu',
      'chưa có dữ liệu',
      'chưa có dữ liệu',
    ])
  })

  it('refuses a non-admin before touching the database', async () => {
    fake.admin = false
    await expect(getAdminOverview()).rejects.toThrow('NOT_FOUND')
    expect(fake.calls).toEqual([['requireAdmin']])
  })

  it.each([
    ['admin_overview', { admin_overview: { data: null, error: { message: 'forbidden' } } }],
    ['an unreadable overview', { admin_overview: { data: { users: {} }, error: null } }],
    ['admin_track_positions', { admin_track_positions: { data: null, error: { message: 'x' } } }],
  ])('throws when %s fails, so the error boundary shows "Thử lại"', async (_name, rpcs) => {
    fake.rpcs = { admin_overview: { data: OVERVIEW, error: null }, ...rpcs }
    await expect(getAdminOverview()).rejects.toThrow()
  })

  it('throws when a metric cannot be read (never "chưa có dữ liệu" for a failure)', async () => {
    fake.rpcs = { admin_overview: { data: OVERVIEW, error: null } }
    fake.metrics = { 'backup.last_success_at': { data: null, error: { message: 'boom' } } }
    await expect(getAdminOverview()).rejects.toThrow()
  })
})

describe('getAdminContent', () => {
  it('reads the track positions as the admin and builds the content page', async () => {
    fake.rpcs = { admin_track_positions: { data: POSITIONS, error: null } }
    const page = await getAdminContent()
    expect(fake.calls).toEqual([['requireAdmin'], ['rpc', 'admin_track_positions']])
    const rows = page.tracks[0]!.roadmaps[0]!.rows
    expect(rows?.map((row) => [row.week, row.learners, row.state])).toEqual([
      [1, 0, 'covered'],
      [2, 3, 'covered'],
      [3, 1, 'covered'],
      [4, 0, 'red'],
      [5, 0, 'red'],
      [6, 0, 'gap'],
    ])
    expect(page.redWeeks).toBe(2)
  })

  it('refuses a non-admin before touching the database', async () => {
    fake.admin = false
    await expect(getAdminContent()).rejects.toThrow('NOT_FOUND')
    expect(fake.calls).toEqual([['requireAdmin']])
  })

  it('throws on an RPC error', async () => {
    fake.rpcs = { admin_track_positions: { data: null, error: { message: 'forbidden' } } }
    await expect(getAdminContent()).rejects.toThrow()
  })
})
