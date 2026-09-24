import { describe, expect, it } from 'vitest'
import { LOCAL_DAY_FIXTURES } from './fixtures'
import {
  addDays,
  DAY_STARTS,
  daysBetween,
  DEFAULT_SCHEDULE,
  isDayStart,
  isLocalDay,
  localDay,
  nextDayStart,
  scheduleAt,
  type LocalDay,
  type Schedule,
  type ScheduleVersion,
} from './localDay'

describe('localDay', () => {
  it.each(LOCAL_DAY_FIXTURES)('$note: $at in $timezone (day start $dayStartsAt)', (fixture) => {
    const schedule: Schedule = { timezone: fixture.timezone, dayStartsAt: fixture.dayStartsAt }
    expect(localDay(new Date(fixture.at), schedule)).toBe(fixture.expected)
  })
})

describe('scheduleAt', () => {
  const versionA: ScheduleVersion = {
    timezone: 'Asia/Ho_Chi_Minh',
    dayStartsAt: '04:00',
    effectiveAt: '2026-01-01T00:00:00Z',
  }
  const versionB: ScheduleVersion = {
    timezone: 'America/Los_Angeles',
    dayStartsAt: '04:00',
    effectiveAt: '2026-06-01T00:00:00Z',
  }

  it('returns DEFAULT_SCHEDULE when there are no versions', () => {
    expect(scheduleAt([], new Date('2026-09-24T00:00:00Z'))).toEqual(DEFAULT_SCHEDULE)
  })

  it('picks the latest version with effectiveAt <= at from an unsorted list', () => {
    // versionB is listed before versionA to prove the function does not rely on input order.
    const versions = [versionB, versionA]
    expect(scheduleAt(versions, new Date('2026-03-01T00:00:00Z'))).toEqual({
      timezone: versionA.timezone,
      dayStartsAt: versionA.dayStartsAt,
    })
    expect(scheduleAt(versions, new Date('2026-09-24T00:00:00Z'))).toEqual({
      timezone: versionB.timezone,
      dayStartsAt: versionB.dayStartsAt,
    })
  })

  it('applies a version effective exactly at `at`', () => {
    expect(scheduleAt([versionA, versionB], new Date(versionB.effectiveAt))).toEqual({
      timezone: versionB.timezone,
      dayStartsAt: versionB.dayStartsAt,
    })
  })

  it('does not apply a future version', () => {
    expect(scheduleAt([versionB], new Date('2026-01-01T00:00:00Z'))).toEqual(DEFAULT_SCHEDULE)
  })
})

describe('RF-1: a schedule change applies from the next day start', () => {
  it('uses the old schedule right before effectiveAt and the new schedule at effectiveAt', () => {
    const scheduleA: Schedule = { timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '04:00' }
    const at = new Date('2026-09-24T03:00:00Z') // 10:00 local (VN)
    const effectiveAt = nextDayStart(at, scheduleA)
    expect(effectiveAt.toISOString()).toBe('2026-09-24T21:00:00.000Z')

    const versionA: ScheduleVersion = {
      ...scheduleA,
      effectiveAt: '2020-01-01T00:00:00Z',
    }
    const versionB: ScheduleVersion = {
      timezone: 'America/Los_Angeles',
      dayStartsAt: '04:00',
      effectiveAt: effectiveAt.toISOString(),
    }
    const versions = [versionA, versionB]

    const justBefore = new Date(effectiveAt.getTime() - 60_000)
    expect(localDay(justBefore, scheduleAt(versions, justBefore))).toBe(
      localDay(justBefore, scheduleA),
    )
    expect(localDay(effectiveAt, scheduleAt(versions, effectiveAt))).toBe(
      localDay(effectiveAt, { timezone: versionB.timezone, dayStartsAt: versionB.dayStartsAt }),
    )
  })
})

describe('nextDayStart', () => {
  it('VN 04:00 at 2026-09-24T03:00:00Z (10:00 local) -> 2026-09-24T21:00:00Z', () => {
    const schedule: Schedule = { timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '04:00' }
    expect(nextDayStart(new Date('2026-09-24T03:00:00Z'), schedule).toISOString()).toBe(
      '2026-09-24T21:00:00.000Z',
    )
  })

  it('VN 04:00 at 2026-09-24T19:00:00Z (02:00 local, still the 24th) -> 2026-09-24T21:00:00Z', () => {
    const schedule: Schedule = { timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '04:00' }
    expect(nextDayStart(new Date('2026-09-24T19:00:00Z'), schedule).toISOString()).toBe(
      '2026-09-24T21:00:00.000Z',
    )
  })

  it('America/St_Johns 04:00 at 2026-09-24T12:00:00Z -> 2026-09-25T06:30:00Z', () => {
    const schedule: Schedule = { timezone: 'America/St_Johns', dayStartsAt: '04:00' }
    expect(nextDayStart(new Date('2026-09-24T12:00:00Z'), schedule).toISOString()).toBe(
      '2026-09-25T06:30:00.000Z',
    )
  })

  it('America/New_York 02:30 at 2026-03-07T12:00:00Z (skipped wall time on 8 March) -> 2026-03-08T07:00:00Z', () => {
    const schedule: Schedule = { timezone: 'America/New_York', dayStartsAt: '02:30' }
    expect(nextDayStart(new Date('2026-03-07T12:00:00Z'), schedule).toISOString()).toBe(
      '2026-03-08T07:00:00.000Z',
    )
  })

  it('America/New_York 04:00 at 2026-10-31T12:00:00Z -> 2026-11-01T09:00:00Z', () => {
    const schedule: Schedule = { timezone: 'America/New_York', dayStartsAt: '04:00' }
    expect(nextDayStart(new Date('2026-10-31T12:00:00Z'), schedule).toISOString()).toBe(
      '2026-11-01T09:00:00.000Z',
    )
  })

  it('America/New_York 01:30 (repeats in the fall-back hour) at 2026-10-31T12:00:00Z -> the first occurrence, 2026-11-01T05:30:00Z', () => {
    const schedule: Schedule = { timezone: 'America/New_York', dayStartsAt: '01:30' }
    expect(nextDayStart(new Date('2026-10-31T12:00:00Z'), schedule).toISOString()).toBe(
      '2026-11-01T05:30:00.000Z',
    )
  })

  describe('property: the day after, and only after', () => {
    const schedules = new Map<string, Schedule>()
    for (const fixture of LOCAL_DAY_FIXTURES) {
      schedules.set(`${fixture.timezone}|${fixture.dayStartsAt}`, {
        timezone: fixture.timezone,
        dayStartsAt: fixture.dayStartsAt,
      })
    }
    const nowValues = [
      new Date('2026-09-24T00:00:00Z'),
      new Date('2026-09-24T12:00:00Z'),
      new Date('2026-09-24T23:45:00Z'),
    ]

    for (const schedule of schedules.values()) {
      for (const now of nowValues) {
        it(`${schedule.timezone} ${schedule.dayStartsAt} at ${now.toISOString()}`, () => {
          const result = nextDayStart(now, schedule)
          expect(localDay(result, schedule)).toBe(addDays(localDay(now, schedule), 1))
          expect(localDay(new Date(result.getTime() - 60_000), schedule)).toBe(
            localDay(now, schedule),
          )
        })
      }
    }
  })

  describe('moving west or east (§5.9: repeats a date westward, skips a date eastward)', () => {
    const STEP_MS = 15 * 60_000
    const WINDOW_DAYS = 2
    const SAMPLES_PER_UNSWITCHED_DAY = 86_400_000 / STEP_MS // 96, at a 15-minute step

    /** Sample `localDay` every 15 minutes across a schedule switch, `windowDays` each side. */
    function sample(versions: readonly ScheduleVersion[], switchAt: Date, windowDays: number) {
      const start = switchAt.getTime() - windowDays * 86_400_000
      const end = switchAt.getTime() + windowDays * 86_400_000
      const days: LocalDay[] = []
      for (let t = start; t <= end; t += STEP_MS) {
        days.push(localDay(new Date(t), scheduleAt(versions, new Date(t))))
      }
      return days
    }

    /** Lengths of each maximal run of consecutive equal dates, in sampled-array order. */
    function runLengths(days: readonly LocalDay[]): number[] {
      const lengths: number[] = []
      let count = 1
      for (let i = 1; i < days.length; i++) {
        if (days[i] === days[i - 1]) {
          count++
        } else {
          lengths.push(count)
          count = 1
        }
      }
      lengths.push(count)
      return lengths
    }

    /**
     * Westward (earlier offset): the local day never skips ahead by more than one calendar day
     * per sample, and at most one date's run of samples is longer than a normal, unswitched day
     * — the date active at the switch, stretched by the new, more-negative UTC offset (§5.9,
     * "moving west can repeat a local date").
     */
    function assertWest(days: readonly LocalDay[]) {
      for (let i = 1; i < days.length; i++) {
        const diff = daysBetween(days[i - 1] as LocalDay, days[i] as LocalDay)
        expect(diff).toBeGreaterThanOrEqual(0)
        expect(diff).toBeLessThanOrEqual(1)
      }
      const extendedRuns = runLengths(days).filter((len) => len > SAMPLES_PER_UNSWITCHED_DAY)
      expect(extendedRuns.length).toBeLessThanOrEqual(1)
    }

    /**
     * Eastward (later offset): the local day never decreases, and at most one sample-to-sample
     * step skips a whole date (a difference of 2, never more) — the date the switch jumps clean
     * over (§5.9, "moving east can skip a date").
     */
    function assertEast(days: readonly LocalDay[]) {
      let skippedDates = 0
      for (let i = 1; i < days.length; i++) {
        const diff = daysBetween(days[i - 1] as LocalDay, days[i] as LocalDay)
        expect(diff).toBeGreaterThanOrEqual(0)
        expect(diff).toBeLessThanOrEqual(2)
        if (diff === 2) skippedDates++
      }
      expect(skippedDates).toBeLessThanOrEqual(1)
    }

    it('VN -> America/Los_Angeles (west): never skips a date, repeats at most one', () => {
      const scheduleA: Schedule = { timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '04:00' }
      const scheduleB: Schedule = { timezone: 'America/Los_Angeles', dayStartsAt: '04:00' }
      const switchAt = nextDayStart(new Date('2026-09-24T03:00:00Z'), scheduleA)
      const versions: ScheduleVersion[] = [
        { ...scheduleA, effectiveAt: '2020-01-01T00:00:00Z' },
        { ...scheduleB, effectiveAt: switchAt.toISOString() },
      ]
      assertWest(sample(versions, switchAt, WINDOW_DAYS))
    })

    it('America/Los_Angeles -> VN (east): never decreases, skips at most one date', () => {
      const scheduleA: Schedule = { timezone: 'America/Los_Angeles', dayStartsAt: '04:00' }
      const scheduleB: Schedule = { timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '04:00' }
      const switchAt = nextDayStart(new Date('2026-09-24T03:00:00Z'), scheduleA)
      const versions: ScheduleVersion[] = [
        { ...scheduleA, effectiveAt: '2020-01-01T00:00:00Z' },
        { ...scheduleB, effectiveAt: switchAt.toISOString() },
      ]
      assertEast(sample(versions, switchAt, WINDOW_DAYS))
    })
  })
})

describe('addDays', () => {
  it('adds across a month boundary', () => {
    expect(addDays('2026-09-28', 5)).toBe('2026-10-03')
  })

  it('adds across a year boundary', () => {
    expect(addDays('2026-12-30', 5)).toBe('2027-01-04')
  })

  it('adds across a leap-day boundary', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-28', 2)).toBe('2028-03-01')
  })

  it('subtracts with a negative count', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('daysBetween', () => {
  it('counts whole days from `from` to `to`', () => {
    expect(daysBetween('2026-09-24', '2026-10-01')).toBe(7)
  })

  it('is negative when `to` is before `from`', () => {
    expect(daysBetween('2026-10-01', '2026-09-24')).toBe(-7)
  })

  it('is zero for the same day', () => {
    expect(daysBetween('2026-09-24', '2026-09-24')).toBe(0)
  })
})

describe('isLocalDay', () => {
  it('accepts a well-formed calendar date', () => {
    expect(isLocalDay('2026-09-24')).toBe(true)
    expect(isLocalDay('2028-02-29')).toBe(true)
  })

  it('rejects malformed or non-existent dates', () => {
    expect(isLocalDay('2026-9-24')).toBe(false)
    expect(isLocalDay('2026-13-01')).toBe(false)
    expect(isLocalDay('2026-02-30')).toBe(false)
    expect(isLocalDay('not-a-date')).toBe(false)
  })
})

describe('isDayStart', () => {
  it('accepts a value on the 30-minute grid within 00:00-12:00', () => {
    expect(isDayStart('04:30')).toBe(true)
    expect(isDayStart('00:00')).toBe(true)
    expect(isDayStart('12:00')).toBe(true)
  })

  it('rejects a value off the grid, out of range or malformed', () => {
    expect(isDayStart('04:15')).toBe(false)
    expect(isDayStart('13:00')).toBe(false)
    expect(isDayStart('4:00')).toBe(false)
  })
})

describe('DAY_STARTS', () => {
  it('has 25 values from 00:00 to 12:00 in 30-minute steps', () => {
    expect(DAY_STARTS.length).toBe(25)
    expect(DAY_STARTS[0]).toBe('00:00')
    expect(DAY_STARTS[DAY_STARTS.length - 1]).toBe('12:00')
  })
})
