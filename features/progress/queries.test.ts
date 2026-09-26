import { beforeEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => ({
  user: { id: 'me', isAdmin: false },
  versions: [] as { timezone: string; dayStartsAt: string; effectiveAt: string }[],
  enrollments: [] as { trackId: string; status: 'active' | 'paused' | 'removed' }[],
  days: {} as Record<string, unknown>,
  calls: [] as unknown[][],
}))

const NOW = new Date('2026-09-28T10:00:00Z')

vi.mock('@/lib/auth/dal', () => ({
  requireOnboarded: async () => {
    fake.calls.push(['requireOnboarded'])
    return fake.user
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    fake.calls.push(['createClient'])
    return { __session: true }
  },
}))

vi.mock('@/lib/plans/catalog', () => ({ planCatalog: () => ({ __catalog: true }) }))

vi.mock('@/lib/plans/reads', () => ({
  readScheduleVersions: async () => {
    fake.calls.push(['readScheduleVersions'])
    return fake.versions
  },
  readEnrollments: async () => {
    fake.calls.push(['readEnrollments'])
    return fake.enrollments
  },
  readDailyActivity: async (_client: unknown, _userId: string, from: string) => {
    fake.calls.push(['readDailyActivity', from])
    return fake.days
  },
  todayOf: () => '2026-09-28',
}))

vi.mock('@/lib/content/catalog', () => ({
  getCatalog: () => ({
    tracks: [
      { id: 'dsa', title: { vi: 'Cấu trúc dữ liệu & Giải thuật', en: 'DSA' }, accent: 'track-1' },
      {
        id: 'english',
        title: { vi: 'Tiếng Anh cho môi trường IT', en: 'English' },
        accent: 'track-2',
      },
    ],
  }),
}))

const { getProgress } = await import('./queries')

beforeEach(() => {
  vi.setSystemTime(NOW)
  fake.user = { id: 'me', isAdmin: false }
  fake.versions = []
  fake.enrollments = []
  fake.days = {}
  fake.calls = []
})

describe('getProgress', () => {
  it('guards first, then reads the schedule, enrollments and a 53-week window of daily activity', async () => {
    await getProgress(undefined)
    expect(fake.calls[0]).toEqual(['requireOnboarded'])
    expect(fake.calls[1]).toEqual(['createClient'])
    expect(fake.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining(['readScheduleVersions', 'readEnrollments', 'readDailyActivity']),
    )
    const dailyActivityCall = fake.calls.find((call) => call[0] === 'readDailyActivity')
    // 53 weeks back from today, today included: 371 days total.
    expect(dailyActivityCall?.[1]).toBe('2025-09-23')
  })

  it('resolves enrolled tracks to their catalog title and accent, dropping unknown catalog ids', async () => {
    fake.enrollments = [
      { trackId: 'dsa', status: 'active' },
      { trackId: 'english', status: 'paused' },
      { trackId: 'unknown-to-catalog', status: 'active' },
    ]
    const page = await getProgress(undefined)
    expect(page.tracks).toEqual([
      { id: 'dsa', title: 'Cấu trúc dữ liệu & Giải thuật', accent: 'track-1' },
      { id: 'english', title: 'Tiếng Anh cho môi trường IT', accent: 'track-2' },
    ])
  })

  it('defaults an invalid or missing ?week= to this week', async () => {
    const missing = await getProgress(undefined)
    expect(missing.week.weekStart).toBe('2026-09-28')
    const garbage = await getProgress('not-a-date')
    expect(garbage.week.weekStart).toBe('2026-09-28')
  })

  it('passes a valid ?week= through', async () => {
    const page = await getProgress('2026-09-14')
    expect(page.week.weekStart).toBe('2026-09-14')
  })
})
