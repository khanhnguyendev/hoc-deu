import { describe, expect, it } from 'vitest'
import { OPS_TIMEZONE, opsDay } from './ops-day'

describe('opsDay (§6.2: run keys by the Asia/Ho_Chi_Minh date; ADR-0027)', () => {
  it('is the Vietnamese date, which turns at 17:00 UTC', () => {
    expect(OPS_TIMEZONE).toBe('Asia/Ho_Chi_Minh')
    expect(opsDay(new Date('2026-10-04T16:59:59.999Z'))).toBe('2026-10-04')
    expect(opsDay(new Date('2026-10-04T17:00:00.000Z'))).toBe('2026-10-05')
  })

  it('turns months and years, zero-padded, whatever the process time zone', () => {
    expect(opsDay(new Date('2026-12-31T17:00:00Z'))).toBe('2027-01-01')
    expect(opsDay(new Date('2027-02-28T16:00:00Z'))).toBe('2027-02-28')
    expect(opsDay(new Date('2027-03-08T23:30:00Z'))).toBe('2027-03-09')
  })
})
