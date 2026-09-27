import { describe, expect, it } from 'vitest'
import type { DailyActivity } from '@/lib/domain/state'
import { addDays, type LocalDay, type ScheduleVersion } from '@/lib/domain/time/localDay'
import { buildProgressPage, weekRangeLabel, type ProgressEnrollment } from './view-model'
import { activityWindowStart } from './window'

const hoChiMinh = { timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '04:00' }

const activity = (
  localDay: LocalDay,
  change: Partial<DailyActivity> = {},
): [LocalDay, DailyActivity] => [
  localDay,
  { localDay, minutesByTrack: {}, itemsDone: 0, completed: false, ...change },
]

const DSA: ProgressEnrollment = {
  trackId: 'dsa',
  status: 'active',
  title: 'Cấu trúc dữ liệu & Giải thuật',
  accent: 'track-1',
}
const ENGLISH: ProgressEnrollment = {
  trackId: 'english',
  status: 'paused',
  title: 'Tiếng Anh cho môi trường IT',
  accent: 'track-2',
}
const REMOVED: ProgressEnrollment = {
  trackId: 'gone',
  status: 'removed',
  title: 'Lộ trình cũ',
  accent: 'track-4',
}

const versions: readonly ScheduleVersion[] = [{ ...hoChiMinh, effectiveAt: '2026-01-01T00:00:00Z' }]

describe('buildProgressPage (§2.4, §5.7, §5.9, decision 24)', () => {
  it('sums every track’s minutes into the heatmap, a removed track included', () => {
    const days = Object.fromEntries([
      activity('2026-09-28', { minutesByTrack: { dsa: 20, gone: 15 } }),
      activity('2026-09-29', { minutesByTrack: { english: 5 } }),
    ])
    const page = buildProgressPage({
      today: '2026-09-29',
      days,
      versions,
      enrollments: [DSA, ENGLISH],
      weekOf: '2026-09-28',
    })
    expect(page.heatmap).toContainEqual({ day: '2026-09-28', minutes: 35 })
    expect(page.heatmap).toContainEqual({ day: '2026-09-29', minutes: 5 })
  })

  it('counts only enrolled (active/paused) tracks in the weekly summary, a removed one excluded', () => {
    const days = Object.fromEntries([
      activity('2026-09-28', {
        minutesByTrack: { dsa: 20, english: 10, gone: 30 },
        itemsDone: 3,
        completed: true,
      }),
    ])
    const page = buildProgressPage({
      today: '2026-09-28',
      days,
      versions,
      enrollments: [DSA, ENGLISH, REMOVED],
      weekOf: '2026-09-28',
    })
    expect(page.week.minutesByTrack).toEqual({ dsa: 20, english: 10 })
    expect(page.week.totalMinutes).toBe(30)
    expect(page.tracks).toEqual([
      { id: 'dsa', title: DSA.title, accent: DSA.accent },
      { id: 'english', title: ENGLISH.title, accent: ENGLISH.accent },
    ])
  })

  it('clamps a future ?week= to this week', () => {
    const page = buildProgressPage({
      today: '2026-09-28', // a Monday
      days: {},
      versions,
      enrollments: [],
      weekOf: '2026-10-05', // next Monday
    })
    expect(page.week.weekStart).toBe('2026-09-28')
    expect(page.nextWeek).toBeNull()
  })

  it('normalises a non-Monday ?week= to its Monday', () => {
    const page = buildProgressPage({
      today: '2026-09-30',
      days: {},
      versions,
      enrollments: [],
      weekOf: '2026-09-30', // a Wednesday
    })
    expect(page.week.weekStart).toBe('2026-09-28')
  })

  it('previousWeek/nextWeek move one week either way; nextWeek is null only for this week', () => {
    const page = buildProgressPage({
      today: '2026-09-28',
      days: {},
      versions,
      enrollments: [],
      weekOf: '2026-09-14',
    })
    expect(page.previousWeek).toBe('2026-09-07')
    expect(page.nextWeek).toBe('2026-09-21')
  })

  it('computes the streak from completed days, skipping schedule-jumped dates (RF-1)', () => {
    const eastVersions: readonly ScheduleVersion[] = [
      { timezone: 'Pacific/Pago_Pago', dayStartsAt: '04:00', effectiveAt: '2026-01-01T00:00:00Z' },
      {
        timezone: 'Pacific/Kiritimati',
        dayStartsAt: '04:00',
        effectiveAt: '2026-10-01T15:00:00Z', // skips 2026-10-01
      },
    ]
    const days = Object.fromEntries([
      activity('2026-09-29', { completed: true }),
      activity('2026-09-30', { completed: true }),
      activity('2026-10-02', { completed: true }),
    ])
    const page = buildProgressPage({
      today: '2026-10-02',
      days,
      versions: eastVersions,
      enrollments: [],
      weekOf: '2026-09-28',
    })
    expect(page.streak).toBe(3)
  })

  it('says which week it shows: this week, last week, or an earlier one (UI I-4)', () => {
    const at = (weekOf: string) =>
      buildProgressPage({ today: '2026-09-30', days: {}, versions, enrollments: [], weekOf })
        .relation
    expect(at('2026-09-30')).toBe('current')
    expect(at('2026-09-21')).toBe('previous')
    expect(at('2026-09-14')).toBe('earlier')
  })

  it('reads the streak over the shared window, the heatmap over its last 53 weeks (m-7)', () => {
    // 380 completed days in a row, ending today: longer than the heatmap's 371 days.
    const today = '2026-09-28'
    const days = Object.fromEntries(
      Array.from({ length: 380 }, (_, back) =>
        activity(addDays(today, -back), { minutesByTrack: { dsa: 10 }, completed: true }),
      ),
    )
    const page = buildProgressPage({ today, days, versions, enrollments: [DSA], weekOf: today })
    expect(page.streak).toBe(380)
    expect(page.heatmap).toHaveLength(53 * 7)
    expect(page.heatmap.every((day) => day.day >= addDays(today, -(53 * 7 - 1)))).toBe(true)
  })

  it('never navigates before the history read: previousWeek stops at its first whole week (m-7)', () => {
    const today = '2026-09-28' // a Monday; the window starts 400 days back, 2025-08-24 (a Sunday)
    const first = activityWindowStart(today)
    expect(first).toBe('2025-08-24')
    const earliest = buildProgressPage({
      today,
      days: {},
      versions,
      enrollments: [],
      weekOf: '2025-08-25',
    })
    expect(earliest.week.weekStart).toBe('2025-08-25')
    expect(earliest.previousWeek).toBeNull()
    expect(earliest.nextWeek).toBe('2025-09-01')
    // A ?week= before the window reads as its first whole week, never all-zero weeks.
    const before = buildProgressPage({
      today,
      days: {},
      versions,
      enrollments: [],
      weekOf: '2024-01-01',
    })
    expect(before.week.weekStart).toBe('2025-08-25')
    expect(before.previousWeek).toBeNull()
  })

  it('reports today, unaltered', () => {
    const page = buildProgressPage({
      today: '2026-09-28',
      days: {},
      versions,
      enrollments: [],
      weekOf: '2026-09-28',
    })
    expect(page.today).toBe('2026-09-28')
  })
})

describe('weekRangeLabel', () => {
  it('formats a Monday..Sunday range as dd/mm – dd/mm', () => {
    expect(weekRangeLabel('2026-09-28')).toBe('28/09 – 04/10')
  })
})
