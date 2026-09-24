import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LOCAL_DAY_FIXTURES } from '@/lib/domain/time/fixtures'
import { LOCAL_DAY_PARITY_SQL_PATH, renderLocalDayParitySql } from './local-day-parity'

describe('renderLocalDayParitySql', () => {
  it('matches the committed pgTAP file (run `pnpm db:fixtures`)', () => {
    const committed = existsSync(LOCAL_DAY_PARITY_SQL_PATH)
      ? readFileSync(LOCAL_DAY_PARITY_SQL_PATH, 'utf8')
      : ''
    expect(committed, 'run `pnpm db:fixtures`').toBe(renderLocalDayParitySql(LOCAL_DAY_FIXTURES))
  })

  it('plans one assertion per fixture', () => {
    const sql = renderLocalDayParitySql(LOCAL_DAY_FIXTURES)
    expect(sql).toContain(`select plan(${LOCAL_DAY_FIXTURES.length});`)
    expect(sql.match(/^select is\(public\.local_day\(/gm)).toHaveLength(LOCAL_DAY_FIXTURES.length)
  })

  it('renders one select is(public.local_day(...)) per fixture', () => {
    const sql = renderLocalDayParitySql([
      {
        at: '2026-09-24T18:30:00Z',
        timezone: 'Asia/Ho_Chi_Minh',
        dayStartsAt: '04:00',
        expected: '2026-09-24',
        note: 'RF-1',
      },
    ])
    expect(sql).toContain(
      "select is(public.local_day('2026-09-24T18:30:00Z'::timestamptz, 'Asia/Ho_Chi_Minh', " +
        "'04:00'::time), '2026-09-24'::date, 'RF-1');",
    )
  })

  it('escapes single quotes', () => {
    const sql = renderLocalDayParitySql([
      {
        at: '2026-09-24T18:30:00Z',
        timezone: 'Asia/Saigon',
        dayStartsAt: '04:00',
        expected: '2026-09-24',
        note: "ICU's name for VN",
      },
    ])
    expect(sql).toContain("'ICU''s name for VN');")
    expect(sql).not.toContain("'ICU's")
  })

  it('silences the pgtap notice and rolls back', () => {
    const sql = renderLocalDayParitySql([])
    expect(sql.indexOf('set client_min_messages = warning;')).toBeLessThan(
      sql.indexOf('create extension if not exists pgtap'),
    )
    expect(sql.trimEnd().endsWith('rollback;')).toBe(true)
  })
})
