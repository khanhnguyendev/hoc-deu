import { describe, expect, it } from 'vitest'
import type { PlanBlock } from '@/lib/domain/plan/types'
import { digest } from '@/lib/events/ids'
import { autoCheckInKey, checkInKey, outcomeKey } from './event-keys'
import { outcomeInputSchema, type CheckInInput, type OutcomeInput } from './schema'

const REQUEST_ID = '3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c'
const PLAN_ID = '9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f'
const BLOCK_ID = '2026-09-28:dsa:new:1'

describe('event keys (decision 16)', () => {
  const result = (fields: Record<string, unknown>, change: Partial<OutcomeInput> = {}) =>
    outcomeInputSchema.parse({
      requestId: REQUEST_ID,
      itemId: 'dsa:p1',
      outcome: { type: 'item.result', ...fields },
      ...change,
    })

  it('outcomeKey is <type>:<item>:<digest of the payload as sent>', () => {
    const key = outcomeKey(result({ result: 'solved', mode: 'recall' }))
    expect(key).toBe(`item.result:dsa:p1:${digest({ result: 'solved', mode: 'recall' })}`)
    expect(key).toMatch(/^item\.result:dsa:p1:[0-9a-f]{16}$/)
  })

  it('outcomeKey is equal for equal inputs, whatever their key order or block', () => {
    const a = outcomeKey(result({ result: 'hint', mode: 'redo' }))
    const b = outcomeKey(result({ mode: 'redo', result: 'hint' }, { blockId: BLOCK_ID }))
    expect(a).toBe(b)
  })

  it('outcomeKey differs for a different grade, mode, item or type', () => {
    const base = outcomeKey(result({ result: 'hint', mode: 'redo' }))
    expect(outcomeKey(result({ result: 'solved', mode: 'redo' }))).not.toBe(base)
    expect(outcomeKey(result({ result: 'hint', mode: 'recall' }))).not.toBe(base)
    expect(outcomeKey(result({ result: 'hint' }))).not.toBe(base)
    expect(outcomeKey(result({ result: 'hint', mode: 'redo' }, { itemId: 'dsa:p2' }))).not.toBe(
      base,
    )
    const skip = outcomeInputSchema.parse({
      requestId: REQUEST_ID,
      itemId: 'dsa:p1',
      outcome: { type: 'item.skipped' },
    })
    expect(outcomeKey(skip)).toMatch(/^item\.skipped:dsa:p1:[0-9a-f]{16}$/)
  })

  const input = (change: Partial<CheckInInput> = {}) => ({
    requestId: REQUEST_ID,
    planId: PLAN_ID,
    blockId: BLOCK_ID,
    status: 'done' as const,
    minutes: 20,
    ...change,
  })

  it('checkInKey is <type>:<plan>:<block>:<digest of the payload as sent>, equal for equal inputs', () => {
    expect(checkInKey(input())).toBe(
      `block.checked_in:${PLAN_ID}:${BLOCK_ID}:${digest({ status: 'done', minutes: 20 })}`,
    )
    expect(checkInKey(input())).toBe(checkInKey({ ...input() }))
  })

  it('checkInKey differs for a different status, minutes or note', () => {
    const base = checkInKey(input())
    expect(checkInKey(input({ status: 'partial' }))).not.toBe(base)
    expect(checkInKey(input({ minutes: 21 }))).not.toBe(base)
    expect(checkInKey(input({ note: 'x' }))).not.toBe(base)
    expect(checkInKey(input({ blockId: '2026-09-28:dsa:new:2' }))).not.toBe(base)
  })

  it('autoCheckInKey is auto:<plan>:<block>:<minutes>:<item count>, and follows both', () => {
    const block: PlanBlock = {
      id: '2026-09-28:dsa:extra:1',
      trackId: 'dsa',
      kind: 'extra',
      estMinutes: 7.5,
      items: [{ itemId: 'dsa:p1', mode: 'new', minutes: 7.5 }],
    }
    expect(autoCheckInKey(PLAN_ID, block, 8)).toBe(`auto:${PLAN_ID}:${block.id}:8:1`)
    const grown: PlanBlock = {
      ...block,
      estMinutes: 17.5,
      items: [...block.items, { itemId: 'dsa:p2', mode: 'new', minutes: 10 }],
    }
    expect(autoCheckInKey(PLAN_ID, grown, 18)).toBe(`auto:${PLAN_ID}:${block.id}:18:2`)
    expect(autoCheckInKey(PLAN_ID, block, 9)).not.toBe(autoCheckInKey(PLAN_ID, block, 8))
  })
})
