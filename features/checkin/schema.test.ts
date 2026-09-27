import { describe, expect, it } from 'vitest'
import { EVENT_PAYLOADS, MAX_PAYLOAD_BYTES, jsonbTextBytes } from '@/lib/domain/events'
import { vi as copy } from '@/lib/i18n/vi'
import {
  checkInInputSchema,
  checkInPayload,
  graphemeCount,
  noteError,
  normalizeNote,
  NOTE_MAX_GRAPHEMES,
  outcomeEvent,
  outcomeInputSchema,
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

describe("noteError (the sheet applies the server's rules, RF-3)", () => {
  const FAMILY_NOTE = FAMILY.repeat(280)
  const BYTES_NOTE = `a${'\u20D0'.repeat(3)}`.repeat(250)

  it.each([
    ['a blank note', '  ', null],
    ['280 graphemes of NFD "ệ"', E_NFD.repeat(280), null],
    ['281 graphemes', E_NFD.repeat(281), copy.checkIn.errors.noteTooLong],
    ['over 1000 UTF-16 units', FAMILY_NOTE, copy.checkIn.errors.noteTooLong],
    ['over the payload bytes', BYTES_NOTE, copy.checkIn.errors.noteTooLong],
    ['U+0000', 'a\u0000b', copy.checkIn.errors.invalid],
  ])('%s → %j', (_case, raw, message) => {
    expect(noteError(raw)).toBe(message)
  })

  it('agrees with checkInInputSchema on every case', () => {
    for (const raw of ['ok', '  ', E_NFD.repeat(281), FAMILY_NOTE, BYTES_NOTE, 'a\uD800b']) {
      const parsed = checkIn({ note: raw })
      const message = noteError(raw)
      expect(parsed.success).toBe(message === null)
      if (!parsed.success) expect(messages(parsed)).toEqual({ note: message })
    }
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

describe('the payloads the keys digest', () => {
  it('outcomeEvent builds each payload with its keys in one order, whatever the input order', () => {
    const parsed = outcomeInputSchema.parse({
      requestId: REQUEST_ID,
      itemId: 'dsa:p1',
      outcome: { mode: 'redo', result: 'hint', type: 'item.result' },
    })
    const event = outcomeEvent(parsed.outcome)
    expect(event).toEqual({ type: 'item.result', payload: { result: 'hint', mode: 'redo' } })
    expect(Object.keys(event.payload)).toEqual(['result', 'mode'])
    expect(outcomeEvent({ type: 'lesson.completed' })).toEqual({
      type: 'lesson.completed',
      payload: {},
    })
  })

  it('checkInPayload sends a note only when there is one', () => {
    const base = { requestId: REQUEST_ID, planId: PLAN_ID, blockId: BLOCK_ID, minutes: 20 }
    expect(checkInPayload({ ...base, status: 'done' })).toEqual({ status: 'done', minutes: 20 })
    expect(checkInPayload({ ...base, status: 'partial', note: 'x' })).toEqual({
      status: 'partial',
      minutes: 20,
      note: 'x',
    })
  })
})
