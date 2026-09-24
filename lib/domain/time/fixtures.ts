import type { DayStart, LocalDay } from './localDay'

/**
 * `localDay` fixtures (task 2.3 brief) — expected values checked independently with Python
 * `zoneinfo` on 2026-09-24. Task 2.5 generates the SQL parity test from this list, so the shape
 * must stay stable: `at` is a UTC instant, `expected` is the `localDay` for that instant under
 * `{ timezone, dayStartsAt }`.
 */
export const LOCAL_DAY_FIXTURES: readonly {
  at: string
  timezone: string
  dayStartsAt: DayStart
  expected: LocalDay
  note: string
}[] = [
  {
    at: '2026-09-24T18:30:00Z',
    timezone: 'Asia/Ho_Chi_Minh',
    dayStartsAt: '04:00',
    expected: '2026-09-24',
    note: 'RF-1: 01:30 counts for the previous day',
  },
  {
    at: '2026-09-24T18:30:00Z',
    timezone: 'Asia/Saigon',
    dayStartsAt: '04:00',
    expected: '2026-09-24',
    note: "legacy alias (ICU's name for VN) — SF8",
  },
  {
    at: '2026-09-24T21:00:00Z',
    timezone: 'Asia/Saigon',
    dayStartsAt: '04:00',
    expected: '2026-09-25',
    note: 'legacy alias at the day start — SF8',
  },
  {
    at: '2026-09-24T21:00:00Z',
    timezone: 'Asia/Ho_Chi_Minh',
    dayStartsAt: '04:00',
    expected: '2026-09-25',
    note: 'the day start itself is the new day',
  },
  {
    at: '2026-09-24T20:59:59Z',
    timezone: 'Asia/Ho_Chi_Minh',
    dayStartsAt: '04:00',
    expected: '2026-09-24',
    note: 'one second before the day start',
  },
  {
    at: '2026-09-24T17:00:00Z',
    timezone: 'Asia/Ho_Chi_Minh',
    dayStartsAt: '00:00',
    expected: '2026-09-25',
    note: 'midnight day start',
  },
  {
    at: '2026-09-25T04:59:00Z',
    timezone: 'Asia/Ho_Chi_Minh',
    dayStartsAt: '12:00',
    expected: '2026-09-24',
    note: 'latest allowed day start, before',
  },
  {
    at: '2026-09-25T05:00:00Z',
    timezone: 'Asia/Ho_Chi_Minh',
    dayStartsAt: '12:00',
    expected: '2026-09-25',
    note: 'latest allowed day start, at',
  },
  {
    at: '2026-09-24T06:00:00Z',
    timezone: 'America/St_Johns',
    dayStartsAt: '04:00',
    expected: '2026-09-23',
    note: 'half-hour offset (NDT −2:30)',
  },
  {
    at: '2026-01-15T07:30:00Z',
    timezone: 'America/St_Johns',
    dayStartsAt: '04:00',
    expected: '2026-01-15',
    note: 'half-hour offset (NST −3:30)',
  },
  {
    at: '2026-03-08T07:30:00Z',
    timezone: 'America/New_York',
    dayStartsAt: '04:00',
    expected: '2026-03-07',
    note: 'spring forward, 03:30 EDT',
  },
  {
    at: '2026-03-08T08:00:00Z',
    timezone: 'America/New_York',
    dayStartsAt: '04:00',
    expected: '2026-03-08',
    note: 'spring forward, 04:00 EDT',
  },
  {
    at: '2026-11-01T08:30:00Z',
    timezone: 'America/New_York',
    dayStartsAt: '04:00',
    expected: '2026-10-31',
    note: 'fall back, 03:30 EST',
  },
  {
    at: '2026-11-01T09:00:00Z',
    timezone: 'America/New_York',
    dayStartsAt: '04:00',
    expected: '2026-11-01',
    note: 'fall back, 04:00 EST',
  },
  {
    at: '2026-09-24T22:00:00Z',
    timezone: 'Asia/Kolkata',
    dayStartsAt: '04:00',
    expected: '2026-09-24',
    note: '+5:30',
  },
  {
    at: '2026-09-24T22:00:00Z',
    timezone: 'Asia/Kolkata',
    dayStartsAt: '03:30',
    expected: '2026-09-25',
    note: '+5:30, half-hour day start',
  },
  {
    at: '2026-09-24T22:15:00Z',
    timezone: 'Asia/Kathmandu',
    dayStartsAt: '04:00',
    expected: '2026-09-25',
    note: '+5:45',
  },
  {
    at: '2026-09-24T14:00:00Z',
    timezone: 'Pacific/Kiritimati',
    dayStartsAt: '04:00',
    expected: '2026-09-25',
    note: '+14',
  },
  {
    at: '2026-09-25T14:59:00Z',
    timezone: 'Pacific/Pago_Pago',
    dayStartsAt: '04:00',
    expected: '2026-09-24',
    note: '−11',
  },
  {
    at: '2028-02-29T23:30:00Z',
    timezone: 'Europe/London',
    dayStartsAt: '00:00',
    expected: '2028-02-29',
    note: 'leap day',
  },
  {
    at: '2028-03-01T03:00:00Z',
    timezone: 'Europe/London',
    dayStartsAt: '04:00',
    expected: '2028-02-29',
    note: 'after a leap day',
  },
  {
    at: '2026-12-31T18:59:59Z',
    timezone: 'Asia/Tokyo',
    dayStartsAt: '04:00',
    expected: '2026-12-31',
    note: 'year boundary, before',
  },
  {
    at: '2026-12-31T19:00:00Z',
    timezone: 'Asia/Tokyo',
    dayStartsAt: '04:00',
    expected: '2027-01-01',
    note: 'year boundary, at',
  },
]
