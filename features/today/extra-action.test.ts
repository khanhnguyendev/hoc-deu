import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlanBlock } from '@/lib/domain/plan/types'
import { vi as copy } from '@/lib/i18n/vi'
import { planEventStore } from '@/lib/plans/__tests__/extra-store'
import {
  NOW,
  planBlock,
  planRow,
  scheduleRow,
  SNAPSHOT,
  TODAY,
  trackRow,
} from '@/lib/plans/__tests__/fixtures'
import { createFakeSupabase, type FakeSupabase } from '@/lib/testing/fake-supabase'

/**
 * [RF-2] "Học thêm" tapped twice in one render (the same request id): `addExtraAction` over the
 * real plan service (`lib/plans/extra.ts`) and the fake's `plan.extra_added` — one addition.
 */
const state = vi.hoisted(() => ({
  fake: null as unknown as import('@/lib/testing/fake-supabase').FakeSupabase,
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/auth/dal', async () => {
  const { USER_ID: id } = await import('@/lib/plans/__tests__/fixtures')
  return { requireOnboarded: async () => ({ id }), getSessionUser: async () => ({ id }) }
})
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => state.fake.client('session') }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.fake.client('admin') }))
vi.mock('@/lib/plans/catalog', async () => {
  const { CATALOG } = await import('@/lib/domain/plan/__tests__/fixtures')
  return { planCatalog: () => CATALOG }
})

const { addExtraAction } = await import('./actions')

const REQUEST_ID = '3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('[RF-2] addExtraAction twice with the same requestId', () => {
  it('applies one plan.extra_added; the second is a duplicate and adds nothing', async () => {
    const plan = planRow({
      date: TODAY,
      blocks: [planBlock(TODAY, 'dsa', 'new', ['dsa:lesson-arrays', 'dsa:p1'])],
      tracks: { dsa: SNAPSHOT },
      seenAt: `${TODAY}T03:00:00.000Z`,
    })
    const fake: FakeSupabase = createFakeSupabase({
      schedule_versions: [scheduleRow()],
      user_tracks: [trackRow('dsa', { start_date: '2026-09-01' })],
      day_plans: [plan],
    })
    planEventStore(fake)
    state.fake = fake

    const input = { requestId: REQUEST_ID, trackId: 'dsa' }
    const added = { ok: true, message: copy.extra.add.added }
    expect(await addExtraAction(input)).toEqual(added)
    expect(await addExtraAction(input)).toEqual(added)

    const calls = fake.rpcs('apply_system_event')
    expect(calls).toHaveLength(2)
    expect((calls[1]?.args.p_event as { id: string }).id).toBe(
      (calls[0]?.args.p_event as { id: string }).id,
    )
    expect(fake.tables.events?.filter((row) => row.type === 'plan.extra_added')).toHaveLength(1)
    const row = fake.tables.day_plans?.[0]
    const extra = (row?.blocks as unknown as PlanBlock[]).find((block) => block.kind === 'extra')
    expect(extra?.items.map((item) => item.itemId)).toEqual(['dsa:p2'])
    expect(row?.version).toBe(2)
  })
})
