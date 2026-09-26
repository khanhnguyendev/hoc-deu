import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type RpcResult = { data: unknown; error: { message: string } | null }

const admin = vi.hoisted(() => ({
  rpc: vi.fn<(name: string, args?: unknown) => Promise<RpcResult>>(),
  create: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: admin.create }))

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
    return Response.json({ total_count: 1, workflow_runs: [{ updated_at: answer }] })
  })
}

const ok = (data: unknown = null): RpcResult => ({ data, error: null })
const EXPECTED_CALLS = [
  ['ops_record_db_size'],
  ['ops_prune'],
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
  admin.create.mockImplementation(() => ({ rpc: admin.rpc }))
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
    expect(report).toEqual({ ok: true, steps: { dbSize: 'ok', prune: 'ok', backups: 'ok' } })
    expect(calls()).toEqual(EXPECTED_CALLS)
  })

  it('a GitHub failure fails only the backups step', async () => {
    const report = await runMaintenance({
      fetch: github({ backup: 500, restore: new TypeError('fetch failed') }),
      now: NOW,
    })
    expect(report).toEqual({ ok: false, steps: { dbSize: 'ok', prune: 'ok', backups: 'failed' } })
    expect(calls()).toEqual([
      ['ops_record_db_size'],
      ['ops_prune'],
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
    expect(report).toEqual({ ok: false, steps: { dbSize: 'failed', prune: 'ok', backups: 'ok' } })
    expect(calls()).toEqual(EXPECTED_CALLS)
  })

  it('a thrown error (not only a returned one) is caught per step', async () => {
    admin.rpc.mockImplementation(async (name) => {
      if (name === 'ops_prune') throw new Error('socket hang up')
      return ok()
    })
    const report = await runMaintenance({ fetch: github(), now: NOW })
    expect(report.steps).toEqual({ dbSize: 'ok', prune: 'failed', backups: 'ok' })
  })

  it('without a database client every step fails, and nothing throws', async () => {
    admin.create.mockImplementation(() => {
      throw new Error('Invalid environment variables: SUPABASE_SECRET_KEY')
    })
    const report = await runMaintenance({ fetch: github(), now: NOW })
    expect(report).toEqual({
      ok: false,
      steps: { dbSize: 'failed', prune: 'failed', backups: 'failed' },
    })
  })

  it('a failed cron.last_run_at write makes the report not ok', async () => {
    admin.rpc.mockImplementation(async (name, args) =>
      name === 'ops_record_metric' && (args as { p_key: string }).p_key === 'cron.last_run_at'
        ? { data: null, error: { message: 'boom' } }
        : ok(),
    )
    const report = await runMaintenance({ fetch: github(), now: NOW })
    expect(report).toEqual({ ok: false, steps: { dbSize: 'ok', prune: 'ok', backups: 'ok' } })
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
    expect(error).toHaveBeenCalledTimes(1)
    expect(String(error.mock.calls[0]?.[0])).toContain('backups')
  })
})
