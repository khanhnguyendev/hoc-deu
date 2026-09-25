import { describe, expect, it } from 'vitest'
import type { PlanWeeklyTemplate } from '../catalog'
import { DSA_TEMPLATE } from './__tests__/fixtures'
import { dayTemplate, planBlockId } from './template'

describe('dayTemplate (platform design §5.4 step 1)', () => {
  it('DSA Monday → review 15 + new', () => {
    expect(dayTemplate(DSA_TEMPLATE, 'mon', 1)).toEqual([
      { kind: 'review', maxMinutes: 15 },
      { kind: 'new' },
    ])
  })

  it('Sunday, week 2 → recap only (the mock interview has fromWeek 3)', () => {
    expect(dayTemplate(DSA_TEMPLATE, 'sun', 2)).toEqual([{ kind: 'recap', count: 3 }])
  })

  it('Sunday, week 3 → mock interview + recap', () => {
    expect(dayTemplate(DSA_TEMPLATE, 'sun', 3)).toEqual([
      { kind: 'practice', tag: 'mock-interview', minutes: 45, fromWeek: 3 },
      { kind: 'recap', count: 3 },
    ])
  })

  it("the weekday's own key wins over 'mon-fri'", () => {
    const template: PlanWeeklyTemplate = {
      'mon-fri': [{ kind: 'review', maxMinutes: 15 }, { kind: 'new' }],
      wed: [{ kind: 'recap', count: 2 }],
    }
    expect(dayTemplate(template, 'wed', 1)).toEqual([{ kind: 'recap', count: 2 }])
    expect(dayTemplate(template, 'thu', 1)).toEqual([
      { kind: 'review', maxMinutes: 15 },
      { kind: 'new' },
    ])
  })

  it("'mon-fri' never applies to Saturday or Sunday", () => {
    const template: PlanWeeklyTemplate = { 'mon-fri': [{ kind: 'new' }] }
    expect(dayTemplate(template, 'sat', 1)).toEqual([])
    expect(dayTemplate(template, 'sun', 1)).toEqual([])
  })

  it('a day with no key → []', () => {
    expect(dayTemplate({ sat: [{ kind: 'review' }] }, 'mon', 1)).toEqual([])
    expect(dayTemplate({}, 'sun', 5)).toEqual([])
  })

  it('never returns the template array itself', () => {
    const blocks = DSA_TEMPLATE['mon-fri']
    const day = dayTemplate(DSA_TEMPLATE, 'tue', 1)
    expect(day).toEqual(blocks)
    expect(day).not.toBe(blocks)
  })
})

describe('planBlockId (platform design §5.4 step 8)', () => {
  it('<planDate>:<trackId>:<kind>:<n>', () => {
    expect(planBlockId('2026-09-28', 'dsa', 'new', 1)).toBe('2026-09-28:dsa:new:1')
    expect(planBlockId('2026-10-04', 'english', 'practice', 2)).toBe(
      '2026-10-04:english:practice:2',
    )
  })
})
