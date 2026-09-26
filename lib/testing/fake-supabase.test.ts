import { describe, expect, it } from 'vitest'
import { createFakeSupabase, MAX_ROWS, type FakeSelect } from './fake-supabase'

const USER = '5b0c61a2-7f5e-4c3b-9a41-2f1d7c8e9a10'
const OTHER = '0f8d6a52-3b1c-4d7e-9a2f-6c5b4e3d2a10'

const version = (userId: string, effectiveAt: string, timezone = 'Asia/Ho_Chi_Minh') => ({
  user_id: userId,
  timezone,
  day_starts_at: '04:00:00',
  effective_at: effectiveAt,
  created_at: effectiveAt,
})

const plan = (id: string, planDate: string, blocks: unknown[], seenAt: string | null = null) => ({
  id,
  user_id: USER,
  plan_date: planDate,
  blocks: blocks as never,
  roadmap_weeks: {},
  version: 1,
  source: 'baseline',
  seen_at: seenAt,
  rules_version: 3,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
})

describe('createFakeSupabase', () => {
  it('filters, orders and projects the selected columns', async () => {
    const fake = createFakeSupabase({
      schedule_versions: [
        version(USER, '2026-09-10T00:00:00Z', 'Europe/Berlin'),
        version(OTHER, '2026-09-05T00:00:00Z'),
        version(USER, '2026-09-01T00:00:00Z'),
      ],
    })
    const { data, error } = await fake
      .client()
      .from('schedule_versions')
      .select('timezone, effective_at')
      .eq('user_id', USER)
      .order('effective_at')
    expect(error).toBeNull()
    expect(data).toEqual([
      { timezone: 'Asia/Ho_Chi_Minh', effective_at: '2026-09-01T00:00:00Z' },
      { timezone: 'Europe/Berlin', effective_at: '2026-09-10T00:00:00Z' },
    ])
  })

  it('supports neq, lt, lte, gt, gte, in, is and not is null', async () => {
    const fake = createFakeSupabase({
      day_plans: [
        plan('p1', '2026-09-25', [], '2026-09-25T03:00:00Z'),
        plan('p2', '2026-09-26', []),
        plan('p3', '2026-09-27', [], '2026-09-27T03:00:00Z'),
        plan('p4', '2026-09-28', [], '2026-09-28T03:00:00Z'),
      ],
    })
    const client = fake.client()
    const ids = async (query: PromiseLike<{ data: { id: string }[] | null }>) =>
      ((await query).data ?? []).map((row) => row.id)

    expect(await ids(client.from('day_plans').select('id').neq('id', 'p1'))).toEqual([
      'p2',
      'p3',
      'p4',
    ])
    expect(await ids(client.from('day_plans').select('id').lt('plan_date', '2026-09-27'))).toEqual([
      'p1',
      'p2',
    ])
    expect(await ids(client.from('day_plans').select('id').lte('plan_date', '2026-09-26'))).toEqual(
      ['p1', 'p2'],
    )
    expect(await ids(client.from('day_plans').select('id').gt('plan_date', '2026-09-27'))).toEqual([
      'p4',
    ])
    expect(await ids(client.from('day_plans').select('id').gte('plan_date', '2026-09-27'))).toEqual(
      ['p3', 'p4'],
    )
    expect(await ids(client.from('day_plans').select('id').in('id', ['p1', 'p4']))).toEqual([
      'p1',
      'p4',
    ])
    expect(await ids(client.from('day_plans').select('id').is('seen_at', null))).toEqual(['p2'])
    expect(
      await ids(
        client
          .from('day_plans')
          .select('id')
          .not('seen_at', 'is', null)
          .lt('plan_date', '2026-09-28')
          .order('plan_date', { ascending: false })
          .limit(1),
      ),
    ).toEqual(['p3'])
  })

  it('matches like patterns as SQL does (% any run, _ one character, the rest literal)', async () => {
    const fake = createFakeSupabase({
      day_plans: [
        plan('2026-09-27:dsa:recap:1', '2026-09-27', []),
        plan('2026-09-27:recap:new:1', '2026-09-27', []),
        plan('2026-09-27:dsa:recapx', '2026-09-27', []),
        plan('a.b', '2026-09-27', []),
        plan('axb', '2026-09-27', []),
      ],
    })
    const ids = async (pattern: string) =>
      ((await fake.client().from('day_plans').select('id').like('id', pattern)).data ?? []).map(
        (row) => row.id,
      )
    expect(await ids('%:recap:%')).toEqual(['2026-09-27:dsa:recap:1', '2026-09-27:recap:new:1'])
    expect(await ids('a.b')).toEqual(['a.b'])
    expect(await ids('a_b')).toEqual(['a.b', 'axb'])
    expect(fake.selects('day_plans')[0]?.filters).toEqual([
      { op: 'like', column: 'id', value: '%:recap:%' },
    ])
  })

  it('answers jsonb containment like Postgres @>', async () => {
    const fake = createFakeSupabase({
      day_plans: [
        plan('recap', '2026-09-27', [
          { id: 'a', kind: 'review', items: [] },
          { id: 'b', kind: 'recap', items: [], recapWeek: 1 },
        ]),
        plan('plain', '2026-09-28', [{ id: 'c', kind: 'new', items: [] }]),
        plan('empty', '2026-09-29', []),
      ],
    })
    const { data } = await fake
      .client()
      .from('day_plans')
      .select('id')
      .contains('blocks', [{ kind: 'recap' }])
    expect(data).toEqual([{ id: 'recap' }])
  })

  it('caps a request without range at MAX_ROWS rows and pages with range', async () => {
    const rows = Array.from({ length: 1500 }, (_, i) => ({
      user_id: USER,
      local_day: `day-${String(i).padStart(4, '0')}`,
      minutes_by_track: {},
      items_done: 0,
      completed: false,
      version: 1,
      rules_version: 3,
    }))
    const fake = createFakeSupabase({ daily_activity: rows })
    const client = fake.client()

    const unpaged = await client.from('daily_activity').select('local_day').eq('user_id', USER)
    expect(MAX_ROWS).toBe(1000)
    expect(unpaged.data).toHaveLength(1000)

    const page = await client
      .from('daily_activity')
      .select('local_day')
      .order('local_day')
      .range(1000, 1999)
    expect(page.data).toHaveLength(500)
    expect(page.data?.[0]).toEqual({ local_day: 'day-1000' })

    const wide = await client.from('daily_activity').select('local_day').range(0, 1999)
    expect(wide.data).toHaveLength(1000)
  })

  it('answers maybeSingle and single', async () => {
    const fake = createFakeSupabase({
      day_plans: [plan('p1', '2026-09-27', []), plan('p2', '2026-09-28', [])],
    })
    const client = fake.client()
    expect((await client.from('day_plans').select('id').eq('id', 'p1').maybeSingle()).data).toEqual(
      { id: 'p1' },
    )
    expect(
      (await client.from('day_plans').select('id').eq('id', 'x').maybeSingle()).data,
    ).toBeNull()
    expect((await client.from('day_plans').select('id').maybeSingle()).error).not.toBeNull()
    expect((await client.from('day_plans').select('id').eq('id', 'p2').single()).data).toEqual({
      id: 'p2',
    })
    expect(
      (await client.from('day_plans').select('id').eq('id', 'x').single()).error,
    ).not.toBeNull()
  })

  it('returns copies, so a caller cannot change the stored rows', async () => {
    const fake = createFakeSupabase({ day_plans: [plan('p1', '2026-09-27', [{ id: 'a' }])] })
    const { data } = await fake.client().from('day_plans').select('*').eq('id', 'p1').single()
    ;(data?.blocks as { id: string }[])[0]!.id = 'changed'
    expect(fake.tables.day_plans?.[0]?.blocks).toEqual([{ id: 'a' }])
  })

  it('records every query and rpc with the client that made it', async () => {
    const fake = createFakeSupabase()
    fake.onRpc('mark_plan_seen', (args) => ({ data: args.p_plan_id === 'p1', error: null }))
    await fake
      .client('session')
      .from('day_plans')
      .select('id')
      .eq('user_id', USER)
      .order('plan_date', { ascending: false })
      .range(0, 9)
    const answer = await fake.client('admin').rpc('mark_plan_seen', { p_plan_id: 'p1' })
    expect(answer).toEqual({ data: true, error: null })

    const [select, rpc] = fake.calls
    expect(select).toEqual<FakeSelect>({
      kind: 'select',
      client: 'session',
      table: 'day_plans',
      columns: 'id',
      filters: [{ op: 'eq', column: 'user_id', value: USER }],
      order: [{ column: 'plan_date', ascending: false }],
      limit: null,
      range: [0, 9],
      single: null,
    })
    expect(rpc).toEqual({
      kind: 'rpc',
      client: 'admin',
      name: 'mark_plan_seen',
      args: { p_plan_id: 'p1' },
    })
    expect(fake.selects('day_plans')).toHaveLength(1)
    expect(fake.rpcs('mark_plan_seen')).toHaveLength(1)
  })

  it('returns the error injected for a table', async () => {
    const fake = createFakeSupabase()
    fake.failSelect('day_plans', 'boom')
    const { data, error } = await fake.client().from('day_plans').select('id')
    expect(data).toBeNull()
    expect(error?.message).toBe('boom')
  })

  it('throws for an rpc without a handler, an unknown column and anything it does not support', async () => {
    const fake = createFakeSupabase({ day_plans: [plan('p1', '2026-09-27', [])] })
    const client = fake.client()
    expect(() => client.rpc('mark_plan_seen', { p_plan_id: 'p1' })).toThrow(/no handler/)
    await expect(async () => client.from('day_plans').select('nope')).rejects.toThrow(/nope/)
    expect(() => client.from('day_plans').insert({} as never)).toThrow(/not supported by the fake/)
    expect(() => client.from('day_plans').select('id').ilike('id', 'p%')).toThrow(
      /not supported by the fake/,
    )
    expect(() => client.from('day_plans').select('id').not('id', 'eq', 'p1')).toThrow(
      /not supported by the fake/,
    )
    expect(() => client.storage).toThrow(/not supported by the fake/)
  })
})
