import { afterEach, describe, expect, it } from 'vitest'
import {
  formatDay,
  formatDayLong,
  formatFinishEstimate,
  formatMinutes,
  formatMonth,
  formatMonthShort,
  formatNumber,
  formatWeeks,
  variantLabel,
} from './format'

const originalTz = process.env.TZ
afterEach(() => {
  process.env.TZ = originalTz
})

describe('formatMinutes', () => {
  it.each([
    [0, '0 phút'],
    [45, '45 phút'],
    [60, '1 giờ'],
    [75, '1 giờ 15 phút'],
    [135, '2 giờ 15 phút'],
  ])('%i → %s', (minutes, text) => {
    expect(formatMinutes(minutes)).toBe(text)
  })
})

describe('formatMinutes with real-world values', () => {
  it.each([
    [12.5, '12,5 phút'],
    [75.5, '1 giờ 15,5 phút'],
    [60_000, '1.000 giờ'],
  ])('%s → %s (vi-VN digits)', (minutes, text) => {
    expect(formatMinutes(minutes)).toBe(text)
  })

  it.each([Number.NaN, undefined, null, -5, Number.POSITIVE_INFINITY])(
    'falls back to 0 phút for %s (RF-4)',
    (minutes) => {
      expect(formatMinutes(minutes)).toBe('0 phút')
    },
  )
})

describe('formatNumber', () => {
  it('uses the Vietnamese decimal comma and thousands dot', () => {
    expect(formatNumber(12.4)).toBe('12,4')
    expect(formatNumber(1234)).toBe('1.234')
  })
})

describe('local-day formatting', () => {
  it('formats a YYYY-MM-DD local day', () => {
    expect(formatDay('2026-02-03')).toBe('3 tháng 2, 2026')
    expect(formatDayLong('2026-02-03')).toBe('Thứ Ba, 3 tháng 2, 2026')
    expect(formatMonth('2026-02-03')).toBe('Tháng 2 năm 2026')
    expect(formatMonthShort('2026-02-03')).toBe('Th2')
    expect(formatMonthShort('2026-12-01')).toBe('Th12')
  })

  it.each(['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Asia/Ho_Chi_Minh'])(
    'never shifts the day in %s',
    (tz) => {
      process.env.TZ = tz
      expect(formatDay('2026-01-01')).toBe('1 tháng 1, 2026')
    },
  )

  it('rejects anything but YYYY-MM-DD', () => {
    expect(() => formatDay('2026-1-1')).toThrow(/YYYY-MM-DD/)
  })
})

describe('formatWeeks', () => {
  it('defaults to one decimal, vi-VN comma', () => {
    expect(formatWeeks(12.4)).toBe('12,4 tuần')
  })

  it('rounds to whole weeks with fractionDigits 0', () => {
    expect(formatWeeks(11.6, 0)).toBe('12 tuần')
  })
})

describe('formatFinishEstimate', () => {
  it('§5.11 simulated-finish sentence', () => {
    expect(
      formatFinishEstimate({
        budgetMinutes: 60,
        variantLabel: '8 tuần',
        medianWeeks: 11.6,
        p90Weeks: 12.4,
      }),
    ).toBe('Với 60 phút/ngày, lộ trình 8 tuần thường hoàn thành sau ~12 tuần (90 %: ~12,4 tuần)')
  })
})

describe('variantLabel', () => {
  it('turns a `<n>w` roadmap id into Vietnamese', () => {
    expect(variantLabel('8w')).toBe('8 tuần')
    expect(variantLabel('10w')).toBe('10 tuần')
  })

  it('leaves any other id unchanged', () => {
    expect(variantLabel('custom')).toBe('custom')
  })
})
