/**
 * Overrides feed the plan engine (§5.12; Part B-M6 decision 18; task 6.6c): `planContext` carries
 * `readOverrides`, so `ensureToday` builds with the effective roadmap and the day's override
 * blocks, and an extra week's used days exclude today's own plan.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { itemState } from '@/lib/domain/plan/__tests__/fixtures'
import { addDays } from '@/lib/domain/time/localDay'
import type { FakeRows, FakeSupabase } from '@/lib/testing/fake-supabase'
import { resetEnv } from './__tests__/env'
import {
  itemStateRow,
  NOW,
  planStore,
  scheduleRow,
  storeCalls,
  TODAY,
  trackRow,
  USER_ID,
} from './__tests__/fixtures'
import { overrideRow, profileRow } from './__tests__/override-rows'

vi.mock('@/lib/auth/dal', async () => (await import('./__tests__/env')).dalMock)
vi.mock('@/lib/supabase/server', async () => (await import('./__tests__/env')).serverMock)
vi.mock('@/lib/supabase/admin', async () => (await import('./__tests__/env')).adminMock)
vi.mock('./catalog', async () => (await import('./__tests__/env')).catalogMock)

const { ensureToday } = await import('./today')
const { loadDay, planContext } = await import('./day')

const DAY_MS = 24 * 60 * 60 * 1000
const clockOn = (offset: number) => new Date(NOW.getTime() + offset * DAY_MS)

/** A DSA learner (AI flag on) with p1 introduced (arrays), p2 Weak. */
function learner(rows: FakeRows = {}, ai = true): FakeSupabase {
  const fake = resetEnv({
    profiles: [profileRow({ ai_personalization: ai })],
    schedule_versions: [scheduleRow()],
    user_tracks: [trackRow('dsa', { start_date: '2026-09-21' })],
    item_state: [
      itemStateRow(itemState('dsa:p1', '2026-09-21')),
      itemStateRow(itemState('dsa:p2', '2026-09-22', { weak: true, status: 'weak' })),
    ],
    ...rows,
  })
  planStore(fake)
  return fake
}

const EXTRA = overrideRow('extra_week', {
  key: 'arrays-extra',
  params: { topicId: 'arrays', studyDays: 5 },
})

const dsaKinds = (blocks: readonly { trackId: string; kind: string }[]) =>
  blocks.filter((block) => block.trackId === 'dsa').map((block) => block.kind)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('planContext carries the overrides (task 6.6c)', () => {
  it('the active overrides of an AI learner', async () => {
    const fake = learner({ roadmap_overrides: [EXTRA] })
    const day = await loadDay(fake.client('session'), USER_ID, NOW)
    const ctx = await planContext(fake.client('session'), USER_ID, day)
    expect(ctx.overrides).toEqual([
      {
        trackId: 'dsa',
        key: 'arrays-extra',
        kind: 'extra_week',
        params: { topicId: 'arrays', studyDays: 5 },
        startLocalDay: TODAY,
        usedDays: 0,
      },
    ])
  })

  it('none once the AI flag is off (a baseline plan)', async () => {
    const fake = learner({ roadmap_overrides: [EXTRA] }, false)
    const day = await loadDay(fake.client('session'), USER_ID, NOW)
    expect((await planContext(fake.client('session'), USER_ID, day)).overrides).toEqual([])
  })
})

describe('ensureToday with an extra week (§5.12)', () => {
  it('builds no new block for the track and names the key; the day after the fifth plan, new is back', async () => {
    const baseline = learner() // the same learner without the override
    await ensureToday(USER_ID, NOW)
    expect(dsaKinds(storeCalls(baseline)[0]?.blocks ?? [])).toContain('new')

    const fake = learner({ roadmap_overrides: [EXTRA] })
    for (let offset = 0; offset < 5; offset += 1) {
      vi.setSystemTime(clockOn(offset))
      await ensureToday(USER_ID, clockOn(offset))
      const call = storeCalls(fake).at(-1)
      expect(call?.planDate).toBe(addDays(TODAY, offset))
      expect(dsaKinds(call?.blocks ?? [])).not.toContain('new')
      expect(call?.tracks.dsa?.extraWeek).toBe('arrays-extra')
    }
    vi.setSystemTime(clockOn(5))
    await ensureToday(USER_ID, clockOn(5))
    const sixth = storeCalls(fake).at(-1)
    expect(sixth?.planDate).toBe(addDays(TODAY, 5))
    expect(sixth?.tracks.dsa?.extraWeek).toBeUndefined()
    expect(dsaKinds(sixth?.blocks ?? [])).toContain('new')
  })

  it('an insert block for today’s weekday comes first in the track’s blocks, tagged topic-practice', async () => {
    const fake = learner({
      roadmap_overrides: [
        overrideRow('insert_block', {
          params: { topicId: 'arrays', weekdays: ['mon'], minutes: 40, until: '2026-10-05' },
        }),
      ],
    })
    await ensureToday(USER_ID, NOW)
    const [first] = (storeCalls(fake)[0]?.blocks ?? []).filter((block) => block.trackId === 'dsa')
    expect(first).toMatchObject({ kind: 'practice', tag: 'topic-practice' })
  })
})
