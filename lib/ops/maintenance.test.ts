import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type RpcResult = { data: unknown; error: { message: string } | null }

const admin = vi.hoisted(() => ({
  rpc: vi.fn<(name: string, args?: unknown) => Promise<RpcResult>>(),
  create: vi.fn(),
  /** The pending `content_publish_requests` rows the publish step reads. */
  pending: [] as { id: number; target: string; pr_url: string | null }[],
  pendingError: null as { message: string } | null,
  /** The tables read, with their filters. */
  reads: [] as string[],
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: admin.create }))

/** `from('content_publish_requests').select(…).eq('status', 'pending')`. */
const from = (table: string) => ({
  select: (columns: string) => ({
    eq: async (column: string, value: string) => {
      admin.reads.push(`${table}:${columns}:${column}=${value}`)
      return { data: admin.pendingError ? null : admin.pending, error: admin.pendingError }
    },
  }),
})

/** The deployed catalog, as the publish step sees it: a problem with a note, and a lesson. */
const catalog = vi.hoisted(() => ({
  items: {} as Record<string, unknown>,
}))
vi.mock('@/lib/content/catalog', () => ({ getCatalog: () => catalog }))

const { runMaintenance } = await import('./maintenance')

const NOW = new Date('2026-09-27T21:03:00Z')
const BACKUP_AT = '2026-09-26T22:07:41Z'
const RESTORE_AT = '2026-09-20T03:12:09Z'
const seconds = (iso: string) => Date.parse(iso) / 1000

/** The GitHub API: the latest successful run per workflow file, or a status for that file. */
function github(answers: { backup?: string | number; restore?: string | number | Error } = {}) {
  const { backup = BACKUP_AT, restore = RESTORE_AT } = answers
  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input)
    const answer = url.includes('/backup.yml/') ? backup : restore
    if (answer instanceof Error) throw answer
    if (typeof answer === 'number') return Response.json({ message: 'x' }, { status: answer })
    return Response.json({
      total_count: 1,
      workflow_runs: [
        {
          updated_at: answer,
          event: 'schedule',
          head_branch: 'main',
          head_repository: { full_name: 'khanhnguyendev/hoc-deu' },
        },
      ],
    })
  })
}

const ok = (data: unknown = null): RpcResult => ({ data, error: null })
const EXPECTED_CALLS = [
  ['ops_record_db_size'],
  ['ops_prune'],
  ['bot_timeout_runs'],
  ['bot_prune_details'],
  ['ops_record_metric', { p_key: 'backup.last_success_at', p_value: seconds(BACKUP_AT) }],
  ['ops_record_metric', { p_key: 'restore_test.last_success_at', p_value: seconds(RESTORE_AT) }],
  ['ops_record_metric', { p_key: 'cron.last_run_at', p_value: NOW.getTime() / 1000 }],
]

beforeEach(() => {
  admin.rpc.mockReset()
  admin.rpc.mockImplementation(async (name) =>
    ok(name === 'ops_prune' ? { event_quota: 0, ops_metrics: 0 } : null),
  )
  admin.create.mockReset()
  admin.create.mockImplementation(() => ({ rpc: admin.rpc, from }))
  admin.pending = []
  admin.pendingError = null
  admin.reads = []
  catalog.items = {
    'dsa:lc-0206': {
      id: 'dsa:lc-0206',
      type: 'problem',
      status: 'active',
      content: { note: { status: 'active' } },
    },
    'dsa:lc-0146': {
      id: 'dsa:lc-0146',
      type: 'problem',
      status: 'active',
      content: { note: { status: 'draft' } },
    },
    'dsa:lesson-trees': { id: 'dsa:lesson-trees', type: 'lesson', status: 'draft', content: {} },
    'dsa:lesson-heap': { id: 'dsa:lesson-heap', type: 'lesson', status: 'active', content: {} },
  }
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** The rpc calls, without the args of the argument-less functions. */
const calls = () =>
  admin.rpc.mock.calls.map(([name, args]) => (args === undefined ? [name] : [name, args]))

describe('runMaintenance (§2.3, §8.4 item 3; ADR-0034)', () => {
  it('runs every step and records the DB size, the prune, both workflows and the run', async () => {
    const report = await runMaintenance({ fetch: github(), now: NOW })
    expect(report).toEqual({
      ok: true,
      steps: {
        dbSize: 'ok',
        prune: 'ok',
        botRuns: 'ok',
        botDetails: 'ok',
        publish: 'ok',
        backups: 'ok',
      },
    })
    expect(calls()).toEqual(EXPECTED_CALLS)
  })

  it('a GitHub failure fails only the backups step', async () => {
    const report = await runMaintenance({
      fetch: github({ backup: 500, restore: new TypeError('fetch failed') }),
      now: NOW,
    })
    expect(report).toEqual({
      ok: false,
      steps: {
        dbSize: 'ok',
        prune: 'ok',
        botRuns: 'ok',
        botDetails: 'ok',
        publish: 'ok',
        backups: 'failed',
      },
    })
    expect(calls()).toEqual([
      ['ops_record_db_size'],
      ['ops_prune'],
      ['bot_timeout_runs'],
      ['bot_prune_details'],
      ['ops_record_metric', { p_key: 'cron.last_run_at', p_value: NOW.getTime() / 1000 }],
    ])
  })

  it('still records the workflow that answered when the other one fails', async () => {
    const report = await runMaintenance({ fetch: github({ restore: 403 }), now: NOW })
    expect(report.steps.backups).toBe('failed')
    expect(report.ok).toBe(false)
    expect(calls()).toContainEqual([
      'ops_record_metric',
      { p_key: 'backup.last_success_at', p_value: seconds(BACKUP_AT) },
    ])
  })

  it('a database error fails its own step and the others run on', async () => {
    admin.rpc.mockImplementation(async (name) =>
      name === 'ops_record_db_size' ? { data: null, error: { message: 'boom' } } : ok(),
    )
    const report = await runMaintenance({ fetch: github(), now: NOW })
    expect(report).toEqual({
      ok: false,
      steps: {
        dbSize: 'failed',
        prune: 'ok',
        botRuns: 'ok',
        botDetails: 'ok',
        publish: 'ok',
        backups: 'ok',
      },
    })
    expect(calls()).toEqual(EXPECTED_CALLS)
  })

  it('a thrown error (not only a returned one) is caught per step', async () => {
    admin.rpc.mockImplementation(async (name) => {
      if (name === 'ops_prune') throw new Error('socket hang up')
      return ok()
    })
    const report = await runMaintenance({ fetch: github(), now: NOW })
    expect(report.steps).toEqual({
      dbSize: 'ok',
      prune: 'failed',
      botRuns: 'ok',
      botDetails: 'ok',
      publish: 'ok',
      backups: 'ok',
    })
  })

  it('times out stale bot runs and prunes old bot details, each in its own step (§2.3)', async () => {
    admin.rpc.mockImplementation(async (name) => {
      if (name === 'bot_timeout_runs') throw new Error('socket hang up')
      return ok(name === 'bot_prune_details' ? 3 : null)
    })
    const failedRuns = await runMaintenance({ fetch: github(), now: NOW })
    expect(failedRuns).toEqual({
      ok: false,
      steps: {
        dbSize: 'ok',
        prune: 'ok',
        botRuns: 'failed',
        botDetails: 'ok',
        publish: 'ok',
        backups: 'ok',
      },
    })
    expect(calls()).toEqual(EXPECTED_CALLS)

    admin.rpc.mockClear()
    admin.rpc.mockImplementation(async (name) =>
      name === 'bot_prune_details' ? { data: null, error: { message: 'boom' } } : ok(0),
    )
    const failedDetails = await runMaintenance({ fetch: github(), now: NOW })
    expect(failedDetails.steps).toEqual({
      dbSize: 'ok',
      prune: 'ok',
      botRuns: 'ok',
      botDetails: 'failed',
      publish: 'ok',
      backups: 'ok',
    })
    expect(calls()).toEqual(EXPECTED_CALLS)
  })

  it('without a database client every step fails, and nothing throws', async () => {
    admin.create.mockImplementation(() => {
      throw new Error('Invalid environment variables: SUPABASE_SECRET_KEY')
    })
    const report = await runMaintenance({ fetch: github(), now: NOW })
    expect(report).toEqual({
      ok: false,
      steps: {
        dbSize: 'failed',
        prune: 'failed',
        botRuns: 'failed',
        botDetails: 'failed',
        publish: 'failed',
        backups: 'failed',
      },
    })
  })

  it('a failed cron.last_run_at write makes the report not ok', async () => {
    admin.rpc.mockImplementation(async (name, args) =>
      name === 'ops_record_metric' && (args as { p_key: string }).p_key === 'cron.last_run_at'
        ? { data: null, error: { message: 'boom' } }
        : ok(),
    )
    const report = await runMaintenance({ fetch: github(), now: NOW })
    expect(report).toEqual({
      ok: false,
      steps: {
        dbSize: 'ok',
        prune: 'ok',
        botRuns: 'ok',
        botDetails: 'ok',
        publish: 'ok',
        backups: 'ok',
      },
    })
  })

  it('running twice makes the same calls and never throws (idempotent)', async () => {
    const fetchImpl = github()
    const first = await runMaintenance({ fetch: fetchImpl, now: NOW })
    const firstCalls = calls()
    admin.rpc.mockClear()
    const second = await runMaintenance({ fetch: fetchImpl, now: NOW })
    expect(second).toEqual(first)
    expect(calls()).toEqual(firstCalls)
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  it('logs the failed step by name, never a secret', async () => {
    const error = vi.mocked(console.error)
    await runMaintenance({ fetch: github({ backup: 500 }), now: NOW })
    // lib/ops/github.ts logs the API status and rate-limit remaining first (M8), then
    // lib/ops/maintenance.ts's own catch logs the step name — neither ever a secret or a row.
    expect(error).toHaveBeenCalledTimes(2)
    expect(String(error.mock.calls[0]?.[0])).toContain('backup.yml')
    expect(String(error.mock.calls[0]?.[0])).toContain('500')
    expect(String(error.mock.calls[1]?.[0])).toContain('backups')
  })
})

describe('the publish step (§2.3, §6.6 lifecycle; decision 20)', () => {
  const PR = (n: number) => `https://github.com/khanhnguyendev/hoc-deu/pull/${n}`

  /** GitHub: workflow runs as `github()`, and each pull request's state. */
  function githubWithPulls(pulls: Record<number, 'open' | 'closed' | 'merged' | number>) {
    const workflows = github()
    return vi.fn<typeof fetch>(async (input, init) => {
      const match = /\/pulls\/(\d+)$/.exec(String(input))
      if (match === null) return workflows(input, init)
      const answer = pulls[Number(match[1])]
      if (answer === undefined || typeof answer === 'number') {
        return Response.json({ message: 'x' }, { status: answer ?? 404 })
      }
      return Response.json({
        state: answer === 'open' ? 'open' : 'closed',
        merged_at: answer === 'merged' ? '2026-09-27T10:00:00Z' : null,
      })
    })
  }

  it('reads only the pending requests', async () => {
    await runMaintenance({ fetch: github(), now: NOW })
    expect(admin.reads).toEqual(['content_publish_requests:id, target, pr_url:status=pending'])
  })

  it('marks merged every pending request whose target the deployed catalog shows active', async () => {
    admin.pending = [
      { id: 1, target: 'dsa:lc-0206#note', pr_url: PR(41) },
      { id: 2, target: 'dsa:lc-0146#note', pr_url: null },
      { id: 3, target: 'dsa:lesson-heap', pr_url: null },
      { id: 4, target: 'dsa:lesson-trees', pr_url: null },
      { id: 5, target: 'dsa:lc-9999', pr_url: null },
    ]
    const fetchImpl = githubWithPulls({})
    const report = await runMaintenance({ fetch: fetchImpl, now: NOW })
    expect(report.steps.publish).toBe('ok')
    expect(calls()).toContainEqual(['publish_mark_merged', { p_ids: [1, 3] }])
    expect(calls().some(([name]) => name === 'publish_clear_pr')).toBe(false)
    // A merged request's PR is not asked about.
    expect(fetchImpl.mock.calls.map(([url]) => String(url))).not.toContainEqual(
      expect.stringContaining('/pulls/'),
    )
  })

  it('clears pr_url of pending requests whose PR was closed unmerged; open and merged stay', async () => {
    admin.pending = [
      { id: 1, target: 'dsa:lc-0146#note', pr_url: PR(41) },
      { id: 2, target: 'dsa:lesson-trees', pr_url: PR(41) },
      { id: 3, target: 'dsa:lesson-trees', pr_url: PR(42) },
      // Merged on GitHub, not deployed yet: stays pending until the catalog shows it.
      { id: 4, target: 'dsa:lesson-trees', pr_url: PR(43) },
    ]
    const fetchImpl = githubWithPulls({ 41: 'closed', 42: 'open', 43: 'merged' })
    const report = await runMaintenance({ fetch: fetchImpl, now: NOW })
    expect(report.steps.publish).toBe('ok')
    expect(calls()).toContainEqual(['publish_clear_pr', { p_ids: [1, 2] }])
    expect(calls().some(([name]) => name === 'publish_mark_merged')).toBe(false)
    // One request per pull request, however many requests it carries.
    const pulls = fetchImpl.mock.calls
      .map(([url]) => String(url))
      .filter((u) => u.includes('/pulls/'))
    expect(pulls).toEqual([
      'https://api.github.com/repos/khanhnguyendev/hoc-deu/pulls/41',
      'https://api.github.com/repos/khanhnguyendev/hoc-deu/pulls/42',
      'https://api.github.com/repos/khanhnguyendev/hoc-deu/pulls/43',
    ])
  })

  it('a PR that cannot be read fails the step, the others are still cleared', async () => {
    admin.pending = [
      { id: 1, target: 'dsa:lesson-trees', pr_url: PR(41) },
      { id: 2, target: 'dsa:lesson-trees', pr_url: PR(42) },
    ]
    const report = await runMaintenance({
      fetch: githubWithPulls({ 41: 403, 42: 'closed' }),
      now: NOW,
    })
    expect(report.steps.publish).toBe('failed')
    expect(report.ok).toBe(false)
    expect(calls()).toContainEqual(['publish_clear_pr', { p_ids: [2] }])
  })

  it('failure isolation: a failed read or write fails only the publish step', async () => {
    admin.pendingError = { message: 'boom' }
    const failedRead = await runMaintenance({ fetch: github(), now: NOW })
    expect(failedRead.steps).toEqual({
      dbSize: 'ok',
      prune: 'ok',
      botRuns: 'ok',
      botDetails: 'ok',
      publish: 'failed',
      backups: 'ok',
    })
    expect(calls()).toEqual(EXPECTED_CALLS)

    admin.rpc.mockClear()
    admin.pendingError = null
    admin.pending = [{ id: 1, target: 'dsa:lesson-heap', pr_url: null }]
    admin.rpc.mockImplementation(async (name) =>
      name === 'publish_mark_merged' ? { data: null, error: { message: 'boom' } } : ok(),
    )
    const failedWrite = await runMaintenance({ fetch: github(), now: NOW })
    expect(failedWrite.steps.publish).toBe('failed')
    expect(failedWrite.steps.backups).toBe('ok')
  })
})
