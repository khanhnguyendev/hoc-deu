import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { EVENT_PAYLOADS, MAX_PAYLOAD_BYTES, jsonbTextBytes } from '@/lib/domain/events'
import type { PlanBlock } from '@/lib/domain/plan/types'
import { vi as copy } from '@/lib/i18n/vi'
import { sha256Hex } from './digest'
import {
  autoCheckInKey,
  checkInInputSchema,
  checkInKey,
  graphemeCount,
  normalizeNote,
  NOTE_MAX_GRAPHEMES,
  outcomeInputSchema,
  outcomeKey,
  type CheckInInput,
  type OutcomeInput,
} from './schema'

const REQUEST_ID = '3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c'
const PLAN_ID = '9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f'
const BLOCK_ID = '2026-09-28:dsa:new:1'

/** "ệ" decomposed (NFD): e + U+0323 + U+0302, as macOS and iOS keyboards may send it. */
const E_NFD = 'ệ'.normalize('NFD')
const FAMILY = '👨‍👩‍👧‍👦'

const checkIn = (change: Record<string, unknown> = {}) =>
  checkInInputSchema.safeParse({
    requestId: REQUEST_ID,
    planId: PLAN_ID,
    blockId: BLOCK_ID,
    status: 'done',
    ...change,
  })

/** The messages of a failed parse, by path. */
function messages(result: ReturnType<typeof checkIn>): Record<string, string> {
  if (result.success) throw new Error('expected a failed parse')
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
  )
}

describe('sha256Hex', () => {
  it.each([
    '',
    'abc',
    'a'.repeat(55),
    'a'.repeat(56),
    'a'.repeat(64),
    'a'.repeat(1000),
    `Ghi chú ${'ệ'.repeat(40)} ${FAMILY}`,
    JSON.stringify({ status: 'done', minutes: 20, note: E_NFD }),
  ])('equals node:crypto sha256 for %j', (text) => {
    expect(sha256Hex(text)).toBe(createHash('sha256').update(text, 'utf8').digest('hex'))
  })
})

describe('notes (RF-3)', () => {
  it('normalizeNote: NFC, trimmed; empty or blank → undefined', () => {
    expect(normalizeNote(`  Học ${E_NFD}  \n`)).toBe('Học ệ')
    expect(normalizeNote(`Học ${E_NFD}`)).not.toBe(`Học ${E_NFD}`)
    expect(normalizeNote('')).toBeUndefined()
    expect(normalizeNote(' \n\t ')).toBeUndefined()
  })

  it('graphemeCount counts user-perceived characters', () => {
    expect(E_NFD.length).toBe(3)
    expect(graphemeCount(E_NFD)).toBe(1)
    expect(graphemeCount(FAMILY)).toBe(1)
    expect(graphemeCount(`a${FAMILY}ệ`)).toBe(3)
    expect(graphemeCount('')).toBe(0)
  })

  it('stores a decomposed (NFD) note as NFC', () => {
    const result = checkIn({ note: `Khó ${E_NFD}` })
    expect(result.success).toBe(true)
    expect(result.data?.note).toBe('Khó ệ')
    expect(result.data?.note).toBe('Khó ệ'.normalize('NFC'))
  })

  it('drops a blank note', () => {
    const result = checkIn({ note: '   ' })
    expect(result.success).toBe(true)
    expect(result.data?.note).toBeUndefined()
  })

  it(`takes ${NOTE_MAX_GRAPHEMES} graphemes of NFD "ệ" and refuses ${NOTE_MAX_GRAPHEMES + 1}`, () => {
    expect(NOTE_MAX_GRAPHEMES).toBe(280)
    const ok = checkIn({ note: E_NFD.repeat(280) })
    expect(ok.success).toBe(true)
    expect(ok.data?.note).toBe('ệ'.repeat(280))
    expect(messages(checkIn({ note: E_NFD.repeat(281) }))).toEqual({
      note: copy.checkIn.errors.noteTooLong,
    })
  })

  it('counts a family emoji (ZWJ sequence) as one grapheme', () => {
    expect(checkIn({ note: `${FAMILY} ok` }).success).toBe(true)
  })

  it('refuses 280 family emoji (under 281 graphemes, over 1000 UTF-16 units) with the same message', () => {
    const note = FAMILY.repeat(280)
    expect(graphemeCount(note)).toBe(280)
    expect(note.length).toBeGreaterThan(1000)
    expect(messages(checkIn({ note }))).toEqual({ note: copy.checkIn.errors.noteTooLong })
  })

  it('refuses a note whose payload would pass the byte limit, with the same message', () => {
    // 250 graphemes and 1000 UTF-16 units, but three bytes of UTF-8 per mark: 2500 bytes.
    const note = `a${'\u20D0'.repeat(3)}`.repeat(250)
    expect(graphemeCount(note)).toBe(250)
    expect(note.length).toBe(1000)
    expect(messages(checkIn({ note }))).toEqual({ note: copy.checkIn.errors.noteTooLong })
  })

  it('keeps every accepted note within the event payload bounds', () => {
    // The worst cases: three-byte letters, JSON escapes (2 bytes), control characters (6 bytes).
    for (const note of [E_NFD.repeat(280), '"\\'.repeat(140), '\u0001'.repeat(280)]) {
      const parsed = checkIn({ note, status: 'partial', minutes: 600 })
      expect(parsed.success).toBe(true)
      const payload = { status: 'partial', minutes: 600, note: parsed.data?.note, auto: false }
      expect(EVENT_PAYLOADS['block.checked_in'].safeParse(payload).success).toBe(true)
      expect(jsonbTextBytes(payload)).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES)
    }
  })

  it('refuses a note that is not text jsonb can store (U+0000, a lone surrogate)', () => {
    expect(checkIn({ note: 'a\u0000b' }).success).toBe(false)
    expect(checkIn({ note: 'a\uD800b' }).success).toBe(false)
  })
})

describe('checkInInputSchema', () => {
  it('takes a one-tap check-in (no minutes) and a sheet check-in', () => {
    expect(checkIn().data).toEqual({
      requestId: REQUEST_ID,
      planId: PLAN_ID,
      blockId: BLOCK_ID,
      status: 'done',
    })
    expect(checkIn({ status: 'partial', minutes: 12, note: 'ok' }).data).toMatchObject({
      status: 'partial',
      minutes: 12,
      note: 'ok',
    })
  })

  it.each([
    ['requestId', { requestId: 'not-a-uuid' }],
    ['planId', { planId: 'plan-1' }],
    ['blockId', { blockId: '' }],
    ['status', { status: 'finished' }],
    ['minutes', { minutes: -1 }],
    ['minutes', { minutes: 601 }],
    ['minutes', { minutes: 7.5 }],
    ['note', { note: 42 }],
  ])('refuses a bad %s', (_field, change) => {
    expect(checkIn(change).success).toBe(false)
  })

  it('refuses unknown keys and non-objects', () => {
    expect(checkIn({ auto: true }).success).toBe(false)
    expect(checkInInputSchema.safeParse(null).success).toBe(false)
  })
})

describe('outcomeInputSchema', () => {
  const outcome = (value: unknown, change: Record<string, unknown> = {}) =>
    outcomeInputSchema.safeParse({
      requestId: REQUEST_ID,
      itemId: 'dsa:p1',
      outcome: value,
      ...change,
    })

  it.each([
    { type: 'item.result', result: 'solved' },
    { type: 'item.result', result: 'hint', mode: 'recall' },
    { type: 'item.result', result: 'dont_know' },
    { type: 'lesson.completed' },
    { type: 'lesson.completed', quizScore: 80 },
    { type: 'exercise.submitted', kind: 'fill-blank', grade: 'close' },
    { type: 'prompt.completed', selfRating: 2 },
    { type: 'prompt.completed' },
    { type: 'item.skipped' },
    { type: 'item.readded' },
  ])('takes %j', (value) => {
    expect(outcome(value).data?.outcome).toEqual(value)
  })

  it.each([
    { type: 'item.result', result: 'perfect' },
    { type: 'item.result', result: 'solved', mode: 'explain-aloud' },
    { type: 'lesson.completed', quizScore: 101 },
    { type: 'exercise.submitted', kind: '', grade: 'pass' },
    { type: 'exercise.submitted', kind: 'x'.repeat(33), grade: 'pass' },
    { type: 'prompt.completed', selfRating: 4 },
    { type: 'item.skipped', extra: true },
    { type: 'track.reset' },
    null,
  ])('refuses %j', (value) => {
    expect(outcome(value).success).toBe(false)
  })

  it('takes an optional block id (?block=) and refuses a bad request or item id', () => {
    expect(outcome({ type: 'item.skipped' }, { blockId: BLOCK_ID }).data?.blockId).toBe(BLOCK_ID)
    expect(outcome({ type: 'item.skipped' }, { requestId: 'x' }).success).toBe(false)
    expect(outcome({ type: 'item.skipped' }, { itemId: '' }).success).toBe(false)
    expect(outcome({ type: 'item.skipped' }, { itemId: 'x'.repeat(129) }).success).toBe(false)
  })
})

describe('event keys (decision 16)', () => {
  const result = (fields: Record<string, unknown>, change: Partial<OutcomeInput> = {}) =>
    outcomeInputSchema.parse({
      requestId: REQUEST_ID,
      itemId: 'dsa:p1',
      outcome: { type: 'item.result', ...fields },
      ...change,
    })

  it('outcomeKey is <type>:<item>:<16 hex of the canonical payload>', () => {
    const key = outcomeKey(result({ result: 'solved', mode: 'recall' }))
    const digest = sha256Hex(JSON.stringify({ result: 'solved', mode: 'recall' })).slice(0, 16)
    expect(key).toBe(`item.result:dsa:p1:${digest}`)
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

  it('checkInKey is <type>:<plan>:<block>:<16 hex>, equal for equal inputs', () => {
    const digest = sha256Hex(JSON.stringify({ status: 'done', minutes: 20 })).slice(0, 16)
    expect(checkInKey(input())).toBe(`block.checked_in:${PLAN_ID}:${BLOCK_ID}:${digest}`)
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
