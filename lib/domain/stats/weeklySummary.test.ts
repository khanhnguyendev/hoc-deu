import { describe, expect, it } from 'vitest'
import type { DailyActivity } from '../state'
import type { LocalDay } from '../time/localDay'
import { weeklySummary } from './weeklySummary'

const activity = (
  change: Partial<DailyActivity> & Pick<DailyActivity, 'localDay'>,
): DailyActivity => ({
  minutesByTrack: {},
  itemsDone: 0,
  completed: false,
  ...change,
})

describe('weeklySummary (§2.4, §5.9, decision 22)', () => {
  it('covers Monday..Sunday even for days without a row', () => {
    const days: Readonly<Record<LocalDay, DailyActivity>> = {
      '2026-09-29': activity({ localDay: '2026-09-29', minutesByTrack: { dsa: 20 }, itemsDone: 2 }),
    }
    const summary = weeklySummary(days, '2026-10-04', new Set(['dsa']))
    expect(summary.weekStart).toBe('2026-09-28')
    expect(summary.days.map((d) => d.localDay)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ])
    const empty = summary.days.find((d) => d.localDay === '2026-09-28')
    expect(empty).toEqual({
      localDay: '2026-09-28',
      minutesByTrack: {},
      minutes: 0,
      itemsDone: 0,
      completed: false,
    })
    const populated = summary.days.find((d) => d.localDay === '2026-09-29')
    expect(populated).toEqual({
      localDay: '2026-09-29',
      minutesByTrack: { dsa: 20 },
      minutes: 20,
      itemsDone: 2,
      completed: false,
    })
  })

  it('sums minutes per track and in total, and item/completed totals', () => {
    const days: Readonly<Record<LocalDay, DailyActivity>> = {
      '2026-09-28': activity({
        localDay: '2026-09-28',
        minutesByTrack: { dsa: 20, english: 10 },
        itemsDone: 3,
        completed: true,
      }),
      '2026-09-29': activity({
        localDay: '2026-09-29',
        minutesByTrack: { dsa: 15 },
        itemsDone: 1,
        completed: true,
      }),
    }
    const summary = weeklySummary(days, '2026-09-28', new Set(['dsa', 'english']))
    expect(summary.minutesByTrack).toEqual({ dsa: 35, english: 10 })
    expect(summary.totalMinutes).toBe(45)
    expect(summary.itemsDone).toBe(4)
    expect(summary.completedDays).toBe(2)
  })

  it('excludes a removed track from minutes, but keeps the day (itemsDone/completed are the day’s own)', () => {
    const days: Readonly<Record<LocalDay, DailyActivity>> = {
      '2026-09-28': activity({
        localDay: '2026-09-28',
        minutesByTrack: { dsa: 20, removed: 30 },
        itemsDone: 5,
        completed: true,
      }),
    }
    const summary = weeklySummary(days, '2026-09-28', new Set(['dsa']))
    const day = summary.days.find((d) => d.localDay === '2026-09-28')
    expect(day?.minutesByTrack).toEqual({ dsa: 20 })
    expect(day?.minutes).toBe(20)
    // itemsDone and completed are the day's own, unaffected by track filtering.
    expect(day?.itemsDone).toBe(5)
    expect(day?.completed).toBe(true)
    expect(summary.minutesByTrack).toEqual({ dsa: 20 })
    expect(summary.totalMinutes).toBe(20)
    expect(summary.itemsDone).toBe(5)
  })
})
