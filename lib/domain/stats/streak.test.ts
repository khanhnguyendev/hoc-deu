import { describe, expect, it } from 'vitest'
import { localDay, type Schedule, type ScheduleVersion } from '../time/localDay'
import { scheduleSkippedDays, streak } from './streak'

describe('streak (§5.7)', () => {
  it('counts consecutive completed days ending today', () => {
    expect(
      streak({
        completedDays: new Set(['2026-09-26', '2026-09-27', '2026-09-28']),
        today: '2026-09-28',
      }),
    ).toBe(3)
  })

  it('counts from yesterday when today is not completed yet', () => {
    expect(
      streak({
        completedDays: new Set(['2026-09-26', '2026-09-27', '2026-09-28']),
        today: '2026-09-29',
      }),
    ).toBe(3)
  })

  it('a gap breaks the streak', () => {
    expect(
      streak({
        completedDays: new Set(['2026-09-26', '2026-09-28']),
        today: '2026-09-28',
      }),
    ).toBe(1)
  })

  it('nothing completed → 0', () => {
    expect(streak({ completedDays: new Set(), today: '2026-09-28' })).toBe(0)
  })

  it('[RF-1] counts across a schedule-skipped date without breaking', () => {
    expect(
      streak({
        completedDays: new Set(['2026-09-29', '2026-09-30', '2026-10-02']),
        today: '2026-10-02',
        skippedDays: new Set(['2026-10-01']),
      }),
    ).toBe(3)
  })
})

describe('scheduleSkippedDays [RF-1]', () => {
  const pagoPago: Schedule = { timezone: 'Pacific/Pago_Pago', dayStartsAt: '04:00' }
  const kiritimati: Schedule = { timezone: 'Pacific/Kiritimati', dayStartsAt: '04:00' }
  const hoChiMinh: Schedule = { timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '04:00' }
  const losAngeles: Schedule = { timezone: 'America/Los_Angeles', dayStartsAt: '04:00' }

  it('moving east (Pago Pago → Kiritimati) at the Pago Pago day start skips exactly the jumped date', () => {
    const effectiveAt = '2026-10-01T15:00:00Z'
    // Sanity check, computed both sides with localDay per the task instructions: just before the
    // change the local day is 09-30 (Pago Pago), and at/after it is 10-02 (Kiritimati).
    const before = localDay(new Date(new Date(effectiveAt).getTime() - 1), pagoPago)
    const after = localDay(new Date(effectiveAt), kiritimati)
    expect(before).toBe('2026-09-30')
    expect(after).toBe('2026-10-02')

    const versions: readonly ScheduleVersion[] = [
      { ...pagoPago, effectiveAt: '2026-01-01T00:00:00Z' },
      { ...kiritimati, effectiveAt },
    ]
    expect(scheduleSkippedDays(versions)).toEqual(new Set(['2026-10-01']))
  })

  it('a jump under 24 hours (Ho Chi Minh → Kiritimati) skips no date', () => {
    const effectiveAt = '2026-10-01T21:00:00Z' // the Ho Chi Minh day start (04:00 +07:00)
    const versions: readonly ScheduleVersion[] = [
      { ...hoChiMinh, effectiveAt: '2026-01-01T00:00:00Z' },
      { ...kiritimati, effectiveAt },
    ]
    expect(scheduleSkippedDays(versions)).toEqual(new Set())
  })

  it('moving west (Ho Chi Minh → Los Angeles) skips nothing', () => {
    const effectiveAt = '2026-10-01T21:00:00Z'
    const versions: readonly ScheduleVersion[] = [
      { ...hoChiMinh, effectiveAt: '2026-01-01T00:00:00Z' },
      { ...losAngeles, effectiveAt },
    ]
    expect(scheduleSkippedDays(versions)).toEqual(new Set())
  })

  it('two identical consecutive versions skip nothing', () => {
    const versions: readonly ScheduleVersion[] = [
      { ...hoChiMinh, effectiveAt: '2026-01-01T00:00:00Z' },
      { ...hoChiMinh, effectiveAt: '2026-06-01T00:00:00Z' },
    ]
    expect(scheduleSkippedDays(versions)).toEqual(new Set())
  })

  it('a single version → the empty set', () => {
    const versions: readonly ScheduleVersion[] = [
      { ...hoChiMinh, effectiveAt: '2026-01-01T00:00:00Z' },
    ]
    expect(scheduleSkippedDays(versions)).toEqual(new Set())
  })

  it('sorts the versions itself: the skipped dates are the same for input given out of order', () => {
    const effectiveAt = '2026-10-01T15:00:00Z'
    const sorted: readonly ScheduleVersion[] = [
      { ...pagoPago, effectiveAt: '2026-01-01T00:00:00Z' },
      { ...kiritimati, effectiveAt },
    ]
    const unsorted: readonly ScheduleVersion[] = [sorted[1]!, sorted[0]!]
    expect(scheduleSkippedDays(unsorted)).toEqual(scheduleSkippedDays(sorted))
    expect(scheduleSkippedDays(unsorted)).toEqual(new Set(['2026-10-01']))
  })

  it('three versions (one east move, one west move) skip only the east jump, given in any order', () => {
    const sorted: readonly ScheduleVersion[] = [
      { ...pagoPago, effectiveAt: '2026-01-01T00:00:00Z' },
      { ...kiritimati, effectiveAt: '2026-03-01T15:00:00Z' }, // east: skips 2026-03-01
      { ...losAngeles, effectiveAt: '2026-04-01T21:00:00Z' }, // west (Kiritimati → Los Angeles): skips nothing
    ]
    const shuffled = [sorted[2]!, sorted[0]!, sorted[1]!]
    expect(scheduleSkippedDays(shuffled)).toEqual(scheduleSkippedDays(sorted))
    expect(scheduleSkippedDays(sorted)).toEqual(new Set(['2026-03-01']))
  })

  it('four versions (two east moves, one west move) skip only the east jumps, given in any order', () => {
    // A second, later east move from Kiritimati (already UTC+14) to another far-east zone would
    // need a zone further east than any real one, so this reuses the Pago → Kiritimati jump twice
    // at different dates, with a Kiritimati → Pago Pago west move (skips nothing) in between.
    const versions: readonly ScheduleVersion[] = [
      { ...pagoPago, effectiveAt: '2026-01-01T00:00:00Z' },
      { ...kiritimati, effectiveAt: '2026-03-01T15:00:00Z' }, // east: skips 2026-03-01
      { ...pagoPago, effectiveAt: '2026-05-01T00:00:00Z' }, // west: skips nothing
      { ...kiritimati, effectiveAt: '2026-07-01T15:00:00Z' }, // east again: skips 2026-07-01
    ]
    const shuffled = [versions[3]!, versions[1]!, versions[0]!, versions[2]!]
    expect(scheduleSkippedDays(shuffled)).toEqual(scheduleSkippedDays(versions))
    expect(scheduleSkippedDays(versions)).toEqual(new Set(['2026-03-01', '2026-07-01']))
  })
})
