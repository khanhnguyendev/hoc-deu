import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BOT_TABLES, botRecordWrite } from './__fixtures__/bot-sql'
import { fakeDb, type FakeDb, type Row } from './__fixtures__/fake-db'
import { bodyHash } from '@/lib/canonical-json'
import { readBody } from './route'
import type { RunUser } from './runs'

const state = vi.hoisted(() => ({ db: undefined as unknown as FakeDb }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db.client }))

const { STORED_ENTRY_BYTES, idempotentWrite } = await import('./writes')

const RUN_USER: RunUser = {
  runUuid: '00000000-0000-4000-8000-000000000100',
  runKey: 'run_2026-10-05',
  mode: 'live',
  runUserId: '00000000-0000-4000-8000-000000000200',
  userId: '00000000-0000-4000-8000-000000000001',
  userRef: 'u_aaaaaaaaaaaaaaaa',
}
const KEY = 'run_2026-10-05:u_aaaaaaaaaaaaaaaa:plan'
const BODY = { targetDate: '2026-10-05', blocks: [{ itemId: 'dsa:lc-0001' }] }

function setup(row: Row = {}): FakeDb {
  state.db = fakeDb(
    {
      bot_run_users: [
        {
          id: RUN_USER.runUserId,
          run_id: RUN_USER.runUuid,
          user_id: RUN_USER.userId,
          user_ref: RUN_USER.userRef,
          outcome: null,
          writes: {},
          detail: null,
          processed_at: null,
          ...row,
        },
      ],
    },
    { ...BOT_TABLES, rpc: { bot_record_write: botRecordWrite } },
  )
  return state.db
}

const request = (key: string | null = KEY) =>
  new Request('https://hocdeu.test/api/bot/v1/runs/x/users/y/plan', {
    method: 'PUT',
    headers: key === null ? {} : { 'Idempotency-Key': key },
  })

const row = () => state.db.tables.bot_run_users?.[0] as Row

const applied = vi.fn(async () => ({
  status: 200,
  body: { outcome: 'applied', planVersion: 2 },
  outcome: 'applied' as const,
}))
const invalid = vi.fn(async () => ({
  status: 422,
  body: { error: 'invalid', details: [{ path: 'blocks.0', message: 'unknown item' }] },
  outcome: 'invalid' as const,
}))

beforeEach(() => {
  applied.mockClear()
  invalid.mockClear()
})

describe('idempotentWrite — the key (decision 10)', () => {
  it.each([
    ['missing', null],
    ['another kind', 'run_2026-10-05:u_aaaaaaaaaaaaaaaa:overrides'],
    ['another ref', 'run_2026-10-05:u_bbbbbbbbbbbbbbbb:plan'],
    ['another run', 'run_2026-10-04:u_aaaaaaaaaaaaaaaa:plan'],
  ])('answers 400 invalid_idempotency_key when it is %s, and writes nothing', async (_, key) => {
    const db = setup()
    const response = await idempotentWrite(RUN_USER, 'plan', request(key), BODY, applied)
    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'invalid_idempotency_key' })
    expect(applied).not.toHaveBeenCalled()
    expect(db.calls).toEqual([])
  })
})

describe('idempotentWrite — record and replay (decision 10, §6.4)', () => {
  it('the first call writes and stores the outcome, the response and the body hash', async () => {
    setup()
    const response = await idempotentWrite(RUN_USER, 'plan', request(), BODY, applied)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ outcome: 'applied', planVersion: 2 })
    expect(applied).toHaveBeenCalledTimes(1)
    expect(row().writes).toEqual({
      plan: {
        outcome: 'applied',
        status: 200,
        body: { outcome: 'applied', planVersion: 2 },
        bodyHash: bodyHash(BODY),
      },
    })
    expect(row()).toMatchObject({ outcome: 'applied' })
    expect(row().processed_at).not.toBeNull()
  })

  it('the same body again (keys in another order) replays the stored response without writing', async () => {
    setup()
    await idempotentWrite(RUN_USER, 'plan', request(), BODY, applied)
    const replay = await idempotentWrite(
      RUN_USER,
      'plan',
      request(),
      { blocks: [{ itemId: 'dsa:lc-0001' }], targetDate: '2026-10-05' },
      applied,
    )
    expect(applied).toHaveBeenCalledTimes(1)
    expect(replay.status).toBe(200)
    expect(replay.headers.get('cache-control')).toBe('no-store')
    expect(await replay.json()).toEqual({ outcome: 'applied', planVersion: 2 })
  })

  it('another body under a used key → 409 idempotency_conflict, nothing written', async () => {
    setup()
    await idempotentWrite(RUN_USER, 'plan', request(), BODY, applied)
    const conflict = await idempotentWrite(
      RUN_USER,
      'plan',
      request(),
      { ...BODY, targetDate: '2026-10-06' },
      applied,
    )
    expect(conflict.status).toBe(409)
    expect(await conflict.json()).toEqual({ error: 'idempotency_conflict' })
    expect(applied).toHaveBeenCalledTimes(1)
  })

  it('kinds are recorded apart: a plan write never answers a custom-items key', async () => {
    setup()
    await idempotentWrite(RUN_USER, 'plan', request(), BODY, applied)
    const items = await idempotentWrite(
      RUN_USER,
      'custom-items',
      request('run_2026-10-05:u_aaaaaaaaaaaaaaaa:custom-items'),
      { items: [] },
      async () => ({ status: 200, body: { outcome: 'dry_run' }, outcome: 'dry_run' as const }),
    )
    expect(await items.json()).toEqual({ outcome: 'dry_run' })
    expect(Object.keys(row().writes as Row)).toEqual(['plan', 'custom-items'])
    // Only the plan write sets the user's outcome (decision 12).
    expect(row().outcome).toBe('applied')
  })

  it('a concurrent first write that stored first → its stored response (or 409 for another body)', async () => {
    setup()
    const racing = (body: unknown) => async () => {
      // Another request stores its answer between this one's read and its record.
      row().writes = {
        plan: {
          outcome: 'applied',
          status: 200,
          body: { outcome: 'applied', planVersion: 7 },
          bodyHash: bodyHash(body),
        },
      }
      return {
        status: 200,
        body: { outcome: 'applied', planVersion: 8 },
        outcome: 'applied' as const,
      }
    }
    const same = await idempotentWrite(RUN_USER, 'plan', request(), BODY, racing(BODY))
    expect(await same.json()).toEqual({ outcome: 'applied', planVersion: 7 })

    setup()
    const other = await idempotentWrite(RUN_USER, 'plan', request(), BODY, racing({ other: 1 }))
    expect(other.status).toBe(409)
    expect(await other.json()).toEqual({ error: 'idempotency_conflict' })
  })

  it('an answer without an outcome (a transient error) is returned and never recorded', async () => {
    setup()
    const response = await idempotentWrite(RUN_USER, 'plan', request(), BODY, async () => ({
      status: 503,
      body: { error: 'disabled' },
    }))
    expect(response.status).toBe(503)
    expect(row().writes).toEqual({})
    expect(row().detail).toBeNull()
  })
})

describe('idempotentWrite — invalid answers never bind the key (decision 10, M6-R18)', () => {
  it('an invalid answer is counted; a corrected body is then accepted', async () => {
    setup()
    const first = await idempotentWrite(RUN_USER, 'plan', request(), { bad: true }, invalid)
    expect(first.status).toBe(422)
    expect(await first.json()).toEqual({
      error: 'invalid',
      details: [{ path: 'blocks.0', message: 'unknown item' }],
    })
    expect(row().writes).toEqual({})
    expect(row().detail).toEqual({ plan: { invalidAttempts: 1 } })

    const corrected = await idempotentWrite(RUN_USER, 'plan', request(), BODY, applied)
    expect(corrected.status).toBe(200)
    expect(applied).toHaveBeenCalledTimes(1)
  })

  it('the fourth invalid attempt → 409 too_many_attempts; a valid body after three is accepted', async () => {
    setup()
    for (const attempt of [1, 2, 3]) {
      const response = await idempotentWrite(RUN_USER, 'plan', request(), { attempt }, invalid)
      expect(response.status).toBe(422)
    }
    const fourth = await idempotentWrite(RUN_USER, 'plan', request(), { attempt: 4 }, invalid)
    expect(fourth.status).toBe(409)
    expect(await fourth.json()).toEqual({ error: 'too_many_attempts' })

    const valid = await idempotentWrite(RUN_USER, 'plan', request(), BODY, applied)
    expect(valid.status).toBe(200)
  })
})

describe('idempotentWrite — bounds', () => {
  it('cuts stored details to fit the writes bound, and answers what it stored', async () => {
    setup()
    const details = Array.from({ length: 400 }, (_, index) => ({
      path: `items.${index}`,
      message: 'x'.repeat(60),
    }))
    const response = await idempotentWrite(RUN_USER, 'plan', request(), BODY, async () => ({
      status: 200,
      body: { outcome: 'skipped_plan_in_use', details },
      outcome: 'skipped_plan_in_use' as const,
    }))
    const answered = (await response.json()) as { details: unknown[] }
    const stored = (row().writes as Record<string, { body: { details: unknown[] } }>).plan
    expect(stored?.body.details.length).toBeLessThan(400)
    expect(answered.details).toEqual(stored?.body.details)
    expect(JSON.stringify(stored).length).toBeLessThanOrEqual(STORED_ENTRY_BYTES + 100)
  })

  it('an invalid answer (it binds nothing) returns every detail, uncut', async () => {
    setup()
    const details = Array.from({ length: 400 }, (_, index) => ({
      path: `items.${index}`,
      message: 'x'.repeat(60),
    }))
    const response = await idempotentWrite(RUN_USER, 'plan', request(), BODY, async () => ({
      status: 422,
      body: { error: 'invalid', details },
      outcome: 'invalid' as const,
    }))
    expect(response.status).toBe(422)
    expect(((await response.json()) as { details: unknown[] }).details).toHaveLength(400)
    expect(row().writes).toEqual({})
  })

  it('a 65 KB body is refused with 413 by readBody, before any key check or write', async () => {
    setup()
    const big = new Request('https://hocdeu.test/x', {
      method: 'PUT',
      headers: { 'Idempotency-Key': KEY },
      body: JSON.stringify({ pad: 'x'.repeat(65 * 1024) }),
    })
    const read = await readBody(big)
    expect(read.ok).toBe(false)
    if (!read.ok) {
      expect(read.response.status).toBe(413)
      expect(await read.response.json()).toEqual({ error: 'too_large' })
    }
    expect(state.db.calls).toEqual([])
  })
})
