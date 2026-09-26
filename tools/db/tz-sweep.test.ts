import { describe, expect, it } from 'vitest'
import { DAY_STARTS } from '@/lib/domain/time/localDay'
import { buildSweepCases, detectTransitions, renderSweepSql } from './tz-sweep'

const FROM_2026 = new Date('2026-01-01T00:00:00Z')
const TO_2028 = new Date('2028-01-01T00:00:00Z')

describe('detectTransitions', () => {
  it('finds both 2026 DST transitions of a zone that observes it', () => {
    const found = detectTransitions('Europe/London', FROM_2026, TO_2028)
    // last Sunday of March (spring forward) and last Sunday of October (fall back), 2026 and 2027.
    expect(found).toHaveLength(4)
    expect(found[0]?.toISOString()).toBe('2026-03-29T01:00:00.000Z')
    expect(found[1]?.toISOString()).toBe('2026-10-25T01:00:00.000Z')
  })

  it('finds nothing for a zone that never changes offset', () => {
    expect(detectTransitions('Asia/Ho_Chi_Minh', FROM_2026, TO_2028)).toHaveLength(0)
  })

  it('finds the 2-hour Antarctica/Troll shift', () => {
    const found = detectTransitions('Antarctica/Troll', FROM_2026, TO_2028)
    expect(found).toHaveLength(4)
  })
})

describe('buildSweepCases', () => {
  it('walks one row per zone × day start × instant — none for a zone with no transition', () => {
    const cases = buildSweepCases(['Europe/London', 'Asia/Ho_Chi_Minh'])
    const londonTransitions = detectTransitions('Europe/London', FROM_2026, TO_2028)
    const WALK_STEPS = cases.length / (londonTransitions.length * DAY_STARTS.length)
    expect(Number.isInteger(WALK_STEPS)).toBe(true)
    expect(cases.every((c) => c.timezone === 'Europe/London')).toBe(true)
    expect(new Set(cases.map((c) => c.dayStartsAt)).size).toBe(DAY_STARTS.length)
  })

  it('the walked instants straddle each transition (some before, some at-or-after)', () => {
    const cases = buildSweepCases(['Europe/London'])
    const [transition] = detectTransitions('Europe/London', FROM_2026, TO_2028)
    if (transition === undefined) throw new Error('expected a transition')
    const forDayStart = cases.filter((c) => c.dayStartsAt === '00:00')
    expect(forDayStart.some((c) => c.now.getTime() < transition.getTime())).toBe(true)
    expect(forDayStart.some((c) => c.tsNext.getTime() >= transition.getTime())).toBe(true)
  })
})

describe('renderSweepSql', () => {
  it('is a single select statement', () => {
    const sql = renderSweepSql(buildSweepCases(['Europe/London']))
    const code = sql
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('--'))
      .join('\n')
    expect(code.match(/;/g)).toHaveLength(1)
    expect(sql.trimEnd().endsWith(';')).toBe(true)
  })

  it('holds one VALUES row per case', () => {
    const cases = buildSweepCases(['Europe/London'])
    const sql = renderSweepSql(cases)
    expect(sql.match(/^ {2}\('/gm)).toHaveLength(cases.length)
  })

  it('casts every value so the VALUES column types never depend on row order', () => {
    const sql = renderSweepSql(buildSweepCases(['Europe/London']))
    for (const line of sql.split('\n').filter((l) => /^ {2}\(/.exec(l))) {
      expect(line).toContain('::timestamptz')
      expect(line).toContain('::time')
    }
  })

  it('compares against the same next-day-start formula the history-floor trigger uses', () => {
    const sql = renderSweepSql(buildSweepCases(['Europe/London']))
    expect(sql).toContain('public.local_day(')
    expect(sql).toContain('at time zone')
    expect(sql).toContain('ts_later_count')
    expect(sql).toContain('max_gap_minutes')
  })
})
