import { describe, expect, it, vi } from 'vitest'
import type { RoadmapOverride } from '@/lib/domain/plan/overrides'
import type { OverrideRow } from '@/lib/plans/reads'

const rows = vi.hoisted(() => ({ value: [] as OverrideRow[], statuses: [] as unknown[] }))
vi.mock('@/lib/plans/reads', () => ({
  readOverrideRows: vi.fn(async (_c: unknown, _u: string, _t: string, statuses: unknown) => {
    rows.statuses.push(statuses)
    return rows.value
  }),
}))

const revoked = vi.hoisted(() => [] as unknown[])
vi.mock('@/lib/events/overrides', () => ({
  revokeOverride: vi.fn(async (_admin: unknown, userId: string, input: unknown) => {
    revoked.push([userId, input])
    return 'applied'
  }),
}))

const { describeOverride, readAiOverrides, revokeReordersOfTrack } = await import('./overrides')
const { createFakeSupabase } = await import('@/lib/testing/fake-supabase')
const { deriveEventId } = await import('@/lib/events/ids')

const TODAY = '2026-10-05'
const INSERT: RoadmapOverride = {
  trackId: 'dsa',
  key: 'ah-extra-practice',
  kind: 'insert_block',
  params: {
    topicId: 'arrays-hashing',
    weekdays: ['fri', 'mon', 'wed'],
    minutes: 15,
    until: '2026-10-19',
  },
  startLocalDay: TODAY,
}
const EXTRA: RoadmapOverride = {
  trackId: 'dsa',
  key: 'ah-extra-week',
  kind: 'extra_week',
  params: { topicId: 'arrays-hashing', studyDays: 5 },
  startLocalDay: TODAY,
  usedDays: 2,
}
const REORDER: RoadmapOverride = {
  trackId: 'dsa',
  key: 'order',
  kind: 'reorder_topics',
  params: { order: ['trees'] },
  startLocalDay: TODAY,
}
const row = (override: RoadmapOverride, change: Partial<OverrideRow> = {}): OverrideRow => ({
  trackId: override.trackId,
  key: override.key,
  kind: override.kind,
  status: 'active',
  revokedBy: null,
  startLocalDay: override.startLocalDay,
  params: override.params,
  override,
  usedDays: override.kind === 'extra_week' ? override.usedDays : 0,
  sqlUsedDays: override.kind === 'extra_week' ? override.usedDays : 0,
  ...change,
})

describe('describeOverride (§2.4’s lines)', () => {
  it.each([
    [INSERT, 'Thêm 15 phút luyện Arrays & Hashing vào T2, T4, T6 đến 19/10'],
    [EXTRA, 'Một tuần luyện thêm chủ đề Arrays & Hashing: còn 3 ngày học'],
    [REORDER, 'Đổi thứ tự các chủ đề sắp tới'],
  ])('%#: %s', (override, text) => {
    expect(describeOverride(override)).toBe(text)
  })
})

describe('readAiOverrides', () => {
  it('lists active and suspended overrides in force, with the track title; expired ones are not', async () => {
    rows.value = [
      row(INSERT),
      row(EXTRA, { status: 'suspended' }),
      row({ ...INSERT, key: 'old', params: { ...INSERT.params, until: '2026-10-04' } }),
      row({ ...EXTRA, key: 'done', usedDays: 5 } as RoadmapOverride),
      row(REORDER, { override: null }),
    ]
    const views = await readAiOverrides({} as never, 'u', TODAY)
    expect(rows.statuses.at(-1)).toEqual(['active', 'suspended'])
    expect(views).toEqual([
      {
        trackId: 'dsa',
        key: 'ah-extra-practice',
        trackTitle: 'Cấu trúc dữ liệu & Giải thuật',
        text: 'Thêm 15 phút luyện Arrays & Hashing vào T2, T4, T6 đến 19/10',
        suspended: false,
      },
      {
        trackId: 'dsa',
        key: 'ah-extra-week',
        trackTitle: 'Cấu trúc dữ liệu & Giải thuật',
        text: 'Một tuần luyện thêm chủ đề Arrays & Hashing: còn 3 ngày học',
        suspended: true,
      },
    ])
  })
})

describe('revokeReordersOfTrack (carried item c: a variant change)', () => {
  it("revokes the track's reorders not revoked yet, as the learner", async () => {
    const USER = '5b0c61a2-7f5e-4c3b-9a41-2f1d7c8e9a10'
    const REQUEST = '0f8d6a52-3b1c-4d7e-9a2f-6c5b4e3d2a10'
    const base = {
      user_id: USER,
      track_id: 'dsa',
      params: {},
      until_local_day: null,
      study_days: null,
      start_local_day: TODAY,
      created_by_run: 'run_2026-10-05',
      created_at: '2026-10-05T00:00:00Z',
      revoked_at: null,
      revoked_by: null,
    }
    const fake = createFakeSupabase({
      roadmap_overrides: [
        { ...base, id: '1', key: 'order-a', kind: 'reorder_topics', status: 'active' },
        { ...base, id: '2', key: 'order-b', kind: 'reorder_topics', status: 'suspended' },
        { ...base, id: '3', key: 'order-c', kind: 'reorder_topics', status: 'revoked' },
        { ...base, id: '4', key: 'ib', kind: 'insert_block', status: 'active' },
        {
          ...base,
          id: '5',
          key: 'order-e',
          kind: 'reorder_topics',
          status: 'active',
          track_id: 'english',
        },
      ],
    })
    expect(
      await revokeReordersOfTrack(fake.client(), fake.client('admin'), USER, 'dsa', REQUEST),
    ).toBe(2)
    expect(revoked).toEqual(
      ['order-a', 'order-b'].map((key) => [
        USER,
        {
          eventId: deriveEventId(REQUEST, `roadmap.override_revoked:dsa:${key}`),
          trackId: 'dsa',
          key,
          kind: 'reorder_topics',
          by: 'learner',
        },
      ]),
    )
  })
})
