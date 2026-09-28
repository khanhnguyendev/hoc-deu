import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BOT_TABLES, botTimeoutRuns, publishSetPr } from './__fixtures__/bot-sql'
import { fakeDb, type FakeDb, type FakeDbOptions, type Row } from './__fixtures__/fake-db'
import { userRef } from './refs'

const SECRET = 'unit-test-ref-secret-0123456789abcdef'
const CATALOG_VERSION = 'c9f2aa00c9f2aa00'

const state = vi.hoisted(() => ({
  db: undefined as unknown as FakeDb,
  /** resolveDay's answer per user id (a Resolution-like object). */
  resolutions: {} as Record<string, unknown>,
  /** loadDay throws for these users. */
  broken: new Set<string>(),
  /** The database's clock (bot_timeout_runs). */
  clock: new Date('2026-10-04T22:30:00Z'),
  /** Runs once, inside the first loadDay: another caller acting during a walk. */
  duringWalk: null as null | (() => Promise<void>),
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db.client }))
vi.mock('@/lib/env', () => ({ serverEnv: () => ({ botRefSecret: SECRET }) }))
vi.mock('@/lib/content/catalog', () => ({ catalogVersion: () => CATALOG_VERSION }))
vi.mock('@/lib/plans/day', () => ({
  loadDay: vi.fn(async (_client: unknown, userId: string) => {
    const during = state.duringWalk
    state.duringWalk = null
    if (during) await during()
    if (state.broken.has(userId)) throw new Error('boom')
    return { today: '2026-10-05', userId }
  }),
  resolveDay: vi.fn(async (_client: unknown, userId: string) => state.resolutions[userId]),
}))

const { finishRun, resolveRunUser, startRun } = await import('./runs')

// 22:30 UTC on 4 October = 05:30 on 5 October in Viet Nam.
const NOW = new Date('2026-10-04T22:30:00Z')
const DAY = '2026-10-05'
const RUN_KEY = `run_${DAY}`

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const USERS = [1, 2, 3, 4, 5, 6].map(uuid)

const OPEN = { kind: 'open' }
const today = (source: 'baseline' | 'ai', seenAt: string | null) => ({
  kind: 'today',
  read: { row: { source, seen_at: seenAt }, plan: null },
})

type Setup = {
  settings?: Partial<Row>
  eligible?: string[]
  runs?: Row[]
  runUsers?: Row[]
  plans?: Row[]
  requests?: Row[]
  onInsert?: FakeDbOptions['onInsert']
}

function setup(input: Setup = {}): FakeDb {
  const eligible = input.eligible ?? USERS
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
      bot_runs: input.runs ?? [],
      bot_run_users: input.runUsers ?? [],
      day_plans: input.plans ?? [],
      content_publish_requests: input.requests ?? [],
    },
    {
      ...BOT_TABLES,
      onInsert: input.onInsert,
      rpc: {
        bot_timeout_runs: botTimeoutRuns(() => state.clock),
        bot_eligible_users: () =>
          eligible.map((userId) => ({ user_id: userId, last_processed_at: null })),
        publish_set_pr: publishSetPr,
      },
    },
  )
  return state.db
}

const runRow = (db: FakeDb, key = RUN_KEY) => db.tables.bot_runs?.find((run) => run.run_key === key)
const runUsers = (db: FakeDb) => db.tables.bot_run_users ?? []

beforeEach(() => {
  state.resolutions = Object.fromEntries(USERS.map((id) => [id, OPEN]))
  state.broken = new Set()
  state.clock = NOW
  state.duringWalk = null
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('startRun — a new plan run (§6.4.1; decisions 8, 9)', () => {
  it('times out stale runs first, then creates run_<Vietnamese date> with every pending user', async () => {
    const db = setup()
    const response = await startRun({ kind: 'plan' }, NOW)
    expect(db.calls[0]).toBe('rpc:bot_timeout_runs')

    const run = runRow(db)
    expect(run).toMatchObject({
      run_key: RUN_KEY,
      kind: 'plan',
      ops_date: DAY,
      mode: 'live',
      status: 'running',
      users_eligible: 6,
      users_deferred: 0,
    })
    const refs = USERS.map((id) => userRef(id, run?.id as string, SECRET))
    expect(response).toEqual({
      runId: RUN_KEY,
      mode: 'live',
      catalogVersion: CATALOG_VERSION,
      rulesVersion: 3,
      contentProposals: true,
      users: refs,
      deferredUsers: 0,
    })
    expect(runUsers(db).map((user) => [user.user_id, user.user_ref, user.outcome])).toEqual(
      USERS.map((id, index) => [id, refs[index], null]),
    )
  })

  it.each([
    ['dry-run on, live requested → dry_run', true, 'live', 'dry_run'],
    ['dry-run on, nothing requested → dry_run', true, undefined, 'dry_run'],
    ['dry-run off, live requested → live', false, 'live', 'live'],
    ['dry-run off, dry_run requested → dry_run', false, 'dry_run', 'dry_run'],
  ] as const)('decides the mode at start: %s', async (_, dryRun, requestedMode, mode) => {
    const db = setup({ settings: { dry_run: dryRun } })
    const response = await startRun({ kind: 'plan', requestedMode }, NOW)
    expect(response.mode).toBe(mode)
    expect(runRow(db)?.mode).toBe(mode)
  })

  it('takes users in the eligible order (least recently processed first) up to the cap; the rest are deferred', async () => {
    const order = [USERS[3], USERS[0], USERS[5], USERS[1], USERS[2], USERS[4]] as string[]
    const db = setup({ settings: { per_run_user_cap: 2 }, eligible: order })
    const response = await startRun({ kind: 'plan' }, NOW)
    const run = runRow(db)
    expect(response).toMatchObject({
      users: order.slice(0, 2).map((id) => userRef(id, run?.id as string, SECRET)),
      deferredUsers: 4,
    })
    expect(run).toMatchObject({ users_eligible: 6, users_deferred: 4 })
    expect(runUsers(db)).toHaveLength(2)
  })

  it('pre-filters: gate closed or resumed today → skipped_gate_closed; no started track → no row; an unseen AI plan → skipped_unseen', async () => {
    const [paused, resumed, noTracks, notStarted, unseenToday, unseenYesterday] = USERS as [
      string,
      string,
      string,
      string,
      string,
      string,
    ]
    const seenAi = uuid(7)
    const baselineUnseen = uuid(8)
    const errored = uuid(9)
    const fresh = uuid(10)
    state.resolutions = {
      [paused]: { kind: 'paused' },
      // A learner who resumed today: "Học tiếp hôm nay" is today's work (decision 9).
      [resumed]: { kind: 'resumed' },
      [noTracks]: { kind: 'noTracks' },
      // The only track starts next week.
      [notStarted]: { kind: 'notStarted', startDate: '2026-10-12' },
      [unseenToday]: today('ai', null),
      [unseenYesterday]: OPEN,
      [seenAi]: OPEN,
      [baselineUnseen]: today('baseline', null),
      [errored]: OPEN,
      [fresh]: OPEN,
    }
    state.broken.add(errored)
    const eligible = [
      paused,
      resumed,
      noTracks,
      notStarted,
      unseenToday,
      unseenYesterday,
      seenAi,
      baselineUnseen,
      errored,
      fresh,
    ]
    const db = setup({
      settings: { per_run_user_cap: 3 },
      eligible,
      plans: [
        // The latest plan before today is an unseen AI plan; an older seen one does not count.
        { user_id: unseenYesterday, plan_date: '2026-10-01', source: 'baseline', seen_at: 'x' },
        { user_id: unseenYesterday, plan_date: '2026-10-04', source: 'ai', seen_at: null },
        { user_id: seenAi, plan_date: '2026-10-04', source: 'ai', seen_at: '2026-10-04T01:00:00Z' },
        // A plan dated after today is never the "most recent" one.
        { user_id: seenAi, plan_date: '2026-10-06', source: 'ai', seen_at: null },
      ],
    })

    const response = await startRun({ kind: 'plan' }, NOW)
    const run = runRow(db)
    const ref = (id: string) => userRef(id, run?.id as string, SECRET)
    const outcomes = Object.fromEntries(runUsers(db).map((user) => [user.user_id, user.outcome]))
    expect(outcomes).toEqual({
      [paused]: 'skipped_gate_closed',
      [resumed]: 'skipped_gate_closed',
      [unseenToday]: 'skipped_unseen',
      [unseenYesterday]: 'skipped_unseen',
      [seenAi]: null,
      [baselineUnseen]: null,
      [errored]: 'error',
      [fresh]: null,
    })
    // Skipped users never count towards the cap; every eligible user was examined.
    expect(response).toMatchObject({
      users: [ref(seenAi), ref(baselineUnseen), ref(fresh)],
      deferredUsers: 0,
    })
    expect(run).toMatchObject({ users_eligible: 10, users_deferred: 0 })
  })
})

describe('startRun — the same day again (decision 8)', () => {
  const RUN_ID = uuid(100)
  const stored = (patch: Row = {}): Row => ({
    id: RUN_ID,
    run_key: RUN_KEY,
    kind: 'plan',
    ops_date: DAY,
    mode: 'live',
    status: 'running',
    failure_reason: null,
    users_eligible: 5,
    users_deferred: 2,
    started_at: '2026-10-04T22:00:00Z',
    finished_at: null,
    ...patch,
  })
  const users = (): Row[] => [
    {
      id: uuid(201),
      run_id: RUN_ID,
      user_id: USERS[0],
      user_ref: 'u_bbbbbbbbbbbbbbbb',
      outcome: null,
      created_at: '2026-10-04T22:00:00.001Z',
    },
    {
      id: uuid(202),
      run_id: RUN_ID,
      user_id: USERS[1],
      user_ref: 'u_cccccccccccccccc',
      outcome: 'applied',
      created_at: '2026-10-04T22:00:00.002Z',
    },
    {
      id: uuid(203),
      run_id: RUN_ID,
      user_id: USERS[2],
      user_ref: 'u_aaaaaaaaaaaaaaaa',
      outcome: null,
      created_at: '2026-10-04T22:00:00.003Z',
    },
  ]

  it('returns the same run and its pending users, and walks no one again', async () => {
    const db = setup({ runs: [stored()], runUsers: users() })
    const response = await startRun({ kind: 'plan' }, NOW)
    expect(response).toEqual({
      runId: RUN_KEY,
      mode: 'live',
      catalogVersion: CATALOG_VERSION,
      rulesVersion: 3,
      contentProposals: true,
      users: ['u_aaaaaaaaaaaaaaaa', 'u_bbbbbbbbbbbbbbbb'],
      deferredUsers: 2,
    })
    expect(db.calls).not.toContain('rpc:bot_eligible_users')
    expect(runUsers(db)).toHaveLength(3)
  })

  it('resumes a failed run as running with the stricter mode (stored dry_run + live request → dry_run)', async () => {
    const db = setup({
      runs: [
        stored({ mode: 'dry_run', status: 'failed', failure_reason: 'timeout', finished_at: 'x' }),
      ],
      runUsers: users(),
    })
    const response = await startRun({ kind: 'plan', requestedMode: 'live' }, NOW)
    expect(response.mode).toBe('dry_run')
    expect(runRow(db)).toMatchObject({
      status: 'running',
      failure_reason: null,
      finished_at: null,
      mode: 'dry_run',
      started_at: NOW.toISOString(),
    })
  })

  it('a resumed run counts its 2 hours from the resume, so a later sweep leaves it running (M6-R23a)', async () => {
    const db = setup({
      runs: [stored({ status: 'running', started_at: '2026-10-04T19:00:00Z' })],
      runUsers: users(),
    })
    // The start's own sweep fails the 3.5-hour-old run; the resume takes it back.
    await startRun({ kind: 'plan' }, NOW)
    expect(runRow(db)).toMatchObject({ status: 'running', started_at: NOW.toISOString() })

    state.clock = new Date(NOW.getTime() + 60 * 60 * 1000)
    await (db.client as { rpc: (name: string) => Promise<unknown> }).rpc('bot_timeout_runs')
    expect(runRow(db)?.status).toBe('running')

    state.clock = new Date(NOW.getTime() + 2 * 60 * 60 * 1000 + 60 * 1000)
    await (db.client as { rpc: (name: string) => Promise<unknown> }).rpc('bot_timeout_runs')
    expect(runRow(db)).toMatchObject({ status: 'failed', failure_reason: 'timeout' })
  })

  it('a live run resumed after an admin turned dry-run on becomes dry_run', async () => {
    const db = setup({ settings: { dry_run: true }, runs: [stored()], runUsers: users() })
    const response = await startRun({ kind: 'plan' }, NOW)
    expect(response.mode).toBe('dry_run')
    expect(runRow(db)?.mode).toBe('dry_run')
  })

  it('a dry-run request on resume makes a live run dry_run; nothing makes it live again', async () => {
    const db = setup({ runs: [stored()], runUsers: users() })
    expect((await startRun({ kind: 'plan', requestedMode: 'dry_run' }, NOW)).mode).toBe('dry_run')
    expect((await startRun({ kind: 'plan', requestedMode: 'live' }, NOW)).mode).toBe('dry_run')
    expect(runRow(db)?.mode).toBe('dry_run')
  })

  it('a completed run answers users: [] and stays completed', async () => {
    const db = setup({
      runs: [stored({ status: 'completed', finished_at: 'x' })],
      runUsers: users(),
    })
    const response = await startRun({ kind: 'plan' }, NOW)
    expect(response).toMatchObject({ runId: RUN_KEY, users: [], deferredUsers: 2 })
    expect(runRow(db)).toMatchObject({ status: 'completed', finished_at: 'x' })
  })
})

describe('startRun — concurrent starts and crashes (M6-R23b)', () => {
  it('a second start during the first one’s walk never gets an empty run', async () => {
    const db = setup({ settings: { per_run_user_cap: 3 } })
    let second: Awaited<ReturnType<typeof startRun>> | undefined
    state.duringWalk = async () => {
      second = await startRun({ kind: 'plan' }, NOW)
    }
    const first = await startRun({ kind: 'plan' }, NOW)
    const run = runRow(db)
    const refs = USERS.slice(0, 3).map((id) => userRef(id, run?.id as string, SECRET))
    expect(db.tables.bot_runs).toHaveLength(1)
    expect(second).toMatchObject({ runId: RUN_KEY, users: refs, deferredUsers: 3 })
    // The first start lost the insert: it resumes the same run and its pending users.
    expect(first).toMatchObject({ runId: RUN_KEY, users: [...refs].sort() })
    expect(runUsers(db)).toHaveLength(3)
  })

  it('a resume after a crash between the two inserts walks again and returns the pending users', async () => {
    let crash = true
    const db = setup({
      settings: { per_run_user_cap: 2 },
      onInsert: (table) => {
        if (table === 'bot_run_users' && crash) {
          crash = false
          throw new Error('connection reset')
        }
      },
    })
    await expect(startRun({ kind: 'plan' }, NOW)).rejects.toThrow()
    // The run exists (never deleted: another caller may have resumed it), without users.
    expect(runRow(db)).toMatchObject({ users_eligible: 6, users_deferred: 4 })
    expect(runUsers(db)).toHaveLength(0)

    const resumed = await startRun({ kind: 'plan' }, NOW)
    const run = runRow(db)
    const refs = USERS.slice(0, 2).map((id) => userRef(id, run?.id as string, SECRET))
    expect(resumed).toMatchObject({ users: [...refs].sort(), deferredUsers: 4 })
    expect(runUsers(db)).toHaveLength(2)
  })

  it('a resume with users recorded never walks again', async () => {
    const db = setup({ settings: { per_run_user_cap: 2 } })
    await startRun({ kind: 'plan' }, NOW)
    db.calls.length = 0
    await startRun({ kind: 'plan' }, NOW)
    expect(db.calls).not.toContain('rpc:bot_eligible_users')
  })
})

describe('startRun — publish runs (§6.2, §6.4.1)', () => {
  const requests = (): Row[] => [
    { id: 17, target: 'dsa:lc-0049#note', status: 'pending', pr_url: null },
    {
      id: 18,
      target: 'dsa:lc-0001',
      status: 'pending',
      pr_url: 'https://github.com/khanhnguyendev/hoc-deu/pull/40',
    },
    { id: 19, target: 'dsa:lc-0002', status: 'merged', pr_url: null },
    { id: 12, target: 'dsa:lesson-heap', status: 'pending', pr_url: null },
  ]

  it('numbers publish runs 1, 2 per date, even after the plan run completed, with the pending requests not in a PR', async () => {
    const db = setup({
      requests: requests(),
      runs: [
        {
          id: uuid(99),
          run_key: 'run_2026-10-04_publish-1',
          kind: 'publish',
          ops_date: '2026-10-04',
          mode: 'live',
          status: 'completed',
        },
        {
          id: uuid(100),
          run_key: RUN_KEY,
          kind: 'plan',
          ops_date: DAY,
          mode: 'live',
          status: 'completed',
        },
      ],
    })
    const first = await startRun({ kind: 'publish' }, NOW)
    expect(first).toEqual({
      runId: `${RUN_KEY}_publish-1`,
      mode: 'live',
      publishRequests: [
        { requestId: 12, target: 'dsa:lesson-heap' },
        { requestId: 17, target: 'dsa:lc-0049#note' },
      ],
    })
    const second = await startRun({ kind: 'publish', requestedMode: 'dry_run' }, NOW)
    expect(second).toMatchObject({ runId: `${RUN_KEY}_publish-2`, mode: 'dry_run' })
    expect(runRow(db, `${RUN_KEY}_publish-2`)).toMatchObject({ kind: 'publish', ops_date: DAY })
    expect(db.calls).not.toContain('rpc:bot_eligible_users')
  })

  it('retries once when a concurrent start took the number', async () => {
    let raced = false
    const db = setup({
      onInsert: (table, _rows, current) => {
        if (table !== 'bot_runs' || raced) return
        raced = true
        current.tables.bot_runs?.push({
          id: uuid(300),
          run_key: `${RUN_KEY}_publish-1`,
          kind: 'publish',
          ops_date: DAY,
          mode: 'live',
          status: 'running',
        })
      },
    })
    const response = await startRun({ kind: 'publish' }, NOW)
    expect(response.runId).toBe(`${RUN_KEY}_publish-2`)
    expect(db.tables.bot_runs).toHaveLength(2)
  })
})

describe('finishRun (§6.4.6)', () => {
  const PUBLISH_KEY = `${RUN_KEY}_publish-1`
  const PR = 'https://github.com/khanhnguyendev/hoc-deu/pull/41'
  const runs = (): Row[] => [
    {
      id: uuid(100),
      run_key: RUN_KEY,
      kind: 'plan',
      mode: 'live',
      status: 'running',
      failure_reason: null,
      summary: null,
      content_pr_url: null,
      finished_at: null,
    },
    {
      id: uuid(101),
      run_key: PUBLISH_KEY,
      kind: 'publish',
      mode: 'live',
      status: 'running',
      failure_reason: null,
      summary: null,
      content_pr_url: null,
      finished_at: null,
    },
  ]
  const requests = (): Row[] => [
    { id: 17, target: 'dsa:lc-0049#note', status: 'pending', pr_url: null },
    { id: 18, target: 'dsa:lc-0001', status: 'cancelled', pr_url: null },
  ]

  it('an unknown run is not_found, and nothing is written', async () => {
    const db = setup({ runs: runs() })
    await expect(finishRun('run_2026-10-06', { status: 'completed' }, NOW)).resolves.toEqual({
      outcome: 'not_found',
    })
    expect(db.calls.filter((call) => call.endsWith(':update'))).toEqual([])
  })

  it('stores the status, finished_at, the summary and the content PR URL', async () => {
    const db = setup({ runs: runs() })
    const result = await finishRun(
      RUN_KEY,
      { status: 'completed', summary: '10 users: 7 plans; PR #41', contentPrUrl: PR },
      NOW,
    )
    expect(result).toEqual({ outcome: 'ok', ignored: [] })
    expect(runRow(db)).toMatchObject({
      status: 'completed',
      failure_reason: null,
      finished_at: NOW.toISOString(),
      summary: '10 users: 7 plans; PR #41',
      content_pr_url: PR,
    })
  })

  it('a failed run records the reason "reported"', async () => {
    const db = setup({ runs: runs() })
    await finishRun(RUN_KEY, { status: 'failed' }, NOW)
    expect(runRow(db)).toMatchObject({
      status: 'failed',
      failure_reason: 'reported',
      summary: null,
    })
  })

  it('a publish run sets pr_url on the listed pending requests; the others are ignored and listed', async () => {
    const db = setup({ runs: runs(), requests: requests() })
    const result = await finishRun(
      PUBLISH_KEY,
      { status: 'completed', contentPrUrl: PR, publishRequestIds: [17, 18, 99, 17] },
      NOW,
    )
    expect(result).toEqual({
      outcome: 'ok',
      ignored: [
        { requestId: 18, reason: 'not_pending' },
        { requestId: 99, reason: 'not_pending' },
      ],
    })
    expect(db.tables.content_publish_requests).toEqual([
      expect.objectContaining({ id: 17, pr_url: PR, status: 'pending' }),
      expect.objectContaining({ id: 18, pr_url: null }),
    ])
    expect(runRow(db, PUBLISH_KEY)).toMatchObject({ status: 'completed', content_pr_url: PR })
  })

  it('request ids without a PR URL, or on a plan run, are ignored', async () => {
    const db = setup({ runs: runs(), requests: requests() })
    await expect(
      finishRun(PUBLISH_KEY, { status: 'completed', publishRequestIds: [17] }, NOW),
    ).resolves.toEqual({ outcome: 'ok', ignored: [{ requestId: 17, reason: 'no_pr_url' }] })
    await expect(
      finishRun(RUN_KEY, { status: 'completed', contentPrUrl: PR, publishRequestIds: [17] }, NOW),
    ).resolves.toEqual({ outcome: 'ok', ignored: [{ requestId: 17, reason: 'not_a_publish_run' }] })
    expect(db.tables.content_publish_requests?.[0]?.pr_url).toBeNull()
    expect(db.calls).not.toContain('rpc:publish_set_pr')
  })
})

describe('resolveRunUser (decision 6: the only way to a user id)', () => {
  const RUN_ID = uuid(100)
  const OTHER_RUN = uuid(101)
  const REF = 'u_aaaaaaaaaaaaaaaa'
  const FOREIGN = 'u_bbbbbbbbbbbbbbbb'
  const runs = (status = 'running', mode = 'live'): Row[] => [
    { id: RUN_ID, run_key: RUN_KEY, kind: 'plan', mode, status },
    { id: OTHER_RUN, run_key: 'run_2026-10-04', kind: 'plan', mode: 'live', status: 'running' },
    {
      id: uuid(102),
      run_key: `${RUN_KEY}_publish-1`,
      kind: 'publish',
      mode: 'live',
      status: 'running',
    },
  ]
  const users = (): Row[] => [
    { id: uuid(200), run_id: RUN_ID, user_id: USERS[0], user_ref: REF },
    { id: uuid(201), run_id: OTHER_RUN, user_id: USERS[1], user_ref: FOREIGN },
  ]

  it('resolves a ref of a running plan run', async () => {
    setup({ runs: runs(), runUsers: users() })
    await expect(resolveRunUser(RUN_KEY, REF)).resolves.toEqual({
      runUuid: RUN_ID,
      runKey: RUN_KEY,
      mode: 'live',
      runUserId: uuid(200),
      userId: USERS[0],
      userRef: REF,
    })
  })

  it.each([
    ['an unknown run', 'run_2026-10-09', REF, 'running'],
    ['a malformed run key', 'run_x', REF, 'running'],
    ['a malformed ref', RUN_KEY, 'u_A', 'running'],
    ['a finished run', RUN_KEY, REF, 'completed'],
    ['a failed run', RUN_KEY, REF, 'failed'],
    ['a ref of another run', RUN_KEY, FOREIGN, 'running'],
    ['a publish run', `${RUN_KEY}_publish-1`, REF, 'running'],
  ])('is null for %s', async (_, runKey, ref, status) => {
    setup({ runs: runs(status), runUsers: users() })
    await expect(resolveRunUser(runKey, ref)).resolves.toBeNull()
  })

  it('takes the stricter mode when an admin turned dry-run on mid-run, and records it on the run', async () => {
    const db = setup({ settings: { dry_run: true }, runs: runs(), runUsers: users() })
    await expect(resolveRunUser(RUN_KEY, REF)).resolves.toMatchObject({ mode: 'dry_run' })
    expect(runRow(db)?.mode).toBe('dry_run')
  })
})
