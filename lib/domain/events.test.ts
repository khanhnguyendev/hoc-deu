import { describe, expect, expectTypeOf, it } from 'vitest'
import { ZodError } from 'zod'
import {
  EVENT_PAYLOADS,
  jsonbTextBytes,
  LEARNER_EVENT_TYPES,
  MAX_PAYLOAD_BYTES,
  parseEventPayload,
  SYSTEM_EVENT_TYPES,
  type EventPayload,
  type EventType,
} from './events'
import { RULES_VERSION } from './rules'

const ALL_TYPES: readonly EventType[] = [
  ...new Set([...LEARNER_EVENT_TYPES, ...SYSTEM_EVENT_TYPES]),
]

const USER_ID = '0b8e5f5c-6f7a-4c8e-9a4b-2d6f1e3c9a10'
const ADMIN_SAMPLE = {
  valid: { targetUserId: USER_ID, from: 'pending', to: 'active' },
  invalid: { targetUserId: 'not-a-uuid' },
}
const AI_RUN_SAMPLE = {
  valid: { runId: 'run-2026-09-24-1', outcome: 'applied', planVersion: 2 },
  invalid: { runId: 'run-2026-09-24-1', outcome: 'applied', planVersion: 0 },
}
const USER_ITEM_SAMPLE = {
  valid: { itemType: 'flashcard', slug: 'big-o-of-hash-maps' },
  invalid: { itemType: 'lesson' },
}
const OVERRIDE_SAMPLE = {
  valid: { key: 'dsa:w3:extra', kind: 'extra_week', params: { weeks: 1 } },
  invalid: { key: 'dsa:w3:extra', kind: 'skip_week' },
}
const OVERRIDE_KEYS_SAMPLE = {
  valid: { keys: ['dsa:w3:extra'] },
  invalid: { keys: 'dsa:w3:extra' },
}
const EMPTY_SAMPLE = { valid: {}, invalid: [] }

/** One valid and one invalid payload per event type (§4.4 payload table, task 2.5 brief). */
const SAMPLES: Record<EventType, { valid: Record<string, unknown>; invalid: unknown }> = {
  'block.checked_in': {
    valid: { status: 'partial', minutes: 25, note: 'Ôn lại two pointers', auto: false },
    invalid: { status: 'partial', minutes: 601 },
  },
  'item.result': { valid: { result: 'hint', mode: 'redo' }, invalid: { result: 'perfect' } },
  'lesson.completed': { valid: { quizScore: 80 }, invalid: { quizScore: 101 } },
  'exercise.submitted': {
    valid: { kind: 'translate', grade: 'close' },
    invalid: { kind: '', grade: 'close' },
  },
  'prompt.completed': { valid: { selfRating: 3 }, invalid: { selfRating: 4 } },
  'item.skipped': EMPTY_SAMPLE,
  'item.readded': EMPTY_SAMPLE,
  'track.enrolled': {
    valid: { roadmapVariant: '10w', budgetMinutes: 45, startDate: '2026-09-25' },
    invalid: { roadmapVariant: '10w', budgetMinutes: 47, startDate: '2026-09-25' },
  },
  'track.updated': {
    valid: {
      budgetMinutes: 60,
      newPerDay: null,
      throttle: [{ dueAbove: 30, newPerDay: 1 }],
      weeklyTemplate: { sat: 90 },
      includeBonus: true,
    },
    invalid: { throttle: [{ dueAbove: -1, newPerDay: 1 }] },
  },
  'track.paused': EMPTY_SAMPLE,
  'track.resumed': { valid: { pausedDays: 3 }, invalid: { pausedDays: -1 } },
  'track.removed': EMPTY_SAMPLE,
  'track.reset': EMPTY_SAMPLE,
  'schedule.changed': {
    valid: {
      timezone: 'Asia/Ho_Chi_Minh',
      dayStartsAt: '04:30',
      effectiveAt: '2026-09-25T04:00:00+07:00',
    },
    invalid: {
      timezone: 'Asia/Ho_Chi_Minh',
      dayStartsAt: '04:15',
      effectiveAt: '2026-09-25T04:00:00+07:00',
    },
  },
  'settings.changed': { valid: { codeLanguage: 'go' }, invalid: { theme: 'sepia' } },
  'plan.generated': {
    valid: { mode: 'resume', planVersion: 1 },
    invalid: { mode: 'restart', planVersion: 1 },
  },
  'plan.extra_added': { valid: { itemIds: ['dsa:arrays:two-sum'] }, invalid: { itemIds: [] } },
  'onboarding.completed': EMPTY_SAMPLE,
  'plan.ai_proposed': AI_RUN_SAMPLE,
  'plan.ai_applied': AI_RUN_SAMPLE,
  'plan.ai_skipped': AI_RUN_SAMPLE,
  'user_item.created': USER_ITEM_SAMPLE,
  'user_item.retired': USER_ITEM_SAMPLE,
  'user_item.hidden': USER_ITEM_SAMPLE,
  'roadmap.override_set': OVERRIDE_SAMPLE,
  'roadmap.override_revoked': OVERRIDE_SAMPLE,
  'roadmap.override_suspended': OVERRIDE_KEYS_SAMPLE,
  'roadmap.override_resumed': OVERRIDE_KEYS_SAMPLE,
  'admin.bot_token_rotated': ADMIN_SAMPLE,
  'admin.bootstrapped': ADMIN_SAMPLE,
  'admin.user_approved': ADMIN_SAMPLE,
  'admin.user_rejected': ADMIN_SAMPLE,
  'admin.user_suspended': ADMIN_SAMPLE,
  'admin.role_changed': ADMIN_SAMPLE,
  'admin.ai_flag_changed': ADMIN_SAMPLE,
  'item.snapshot': {
    valid: {
      level: 3,
      weak: false,
      topSuccesses: 2,
      dueOn: '2026-10-01',
      lapses: 1,
      reps: 5,
      rulesVersion: RULES_VERSION,
    },
    invalid: {
      level: 3,
      weak: false,
      topSuccesses: 2,
      dueOn: '2026-02-30',
      lapses: 1,
      reps: 5,
      rulesVersion: RULES_VERSION,
    },
  },
}

describe('event type lists', () => {
  it('give every type in both lists a payload schema, and nothing else', () => {
    expect(Object.keys(EVENT_PAYLOADS).sort()).toEqual([...ALL_TYPES].sort())
    expect(Object.keys(SAMPLES).sort()).toEqual([...ALL_TYPES].sort())
  })

  it('are disjoint except block.checked_in (learner check-in and the auto check-in)', () => {
    const system = new Set<string>(SYSTEM_EVENT_TYPES)
    expect(LEARNER_EVENT_TYPES.filter((type) => system.has(type))).toEqual(['block.checked_in'])
  })

  it('have no duplicates', () => {
    expect(new Set(LEARNER_EVENT_TYPES).size).toBe(LEARNER_EVENT_TYPES.length)
    expect(new Set(SYSTEM_EVENT_TYPES).size).toBe(SYSTEM_EVENT_TYPES.length)
  })

  it.each(ALL_TYPES)('%s matches the database check on events.type', (type) => {
    expect(type).toMatch(/^[a-z_]+\.[a-z_]+$/)
  })
})

describe('parseEventPayload', () => {
  it.each(ALL_TYPES)('%s accepts its valid sample', (type) => {
    expect(parseEventPayload(type, SAMPLES[type].valid)).toEqual(SAMPLES[type].valid)
  })

  it.each(ALL_TYPES)('%s rejects its invalid sample', (type) => {
    expect(() => parseEventPayload(type, SAMPLES[type].invalid)).toThrow(ZodError)
  })

  it.each(ALL_TYPES)('%s rejects an unknown key (strict)', (type) => {
    expect(() => parseEventPayload(type, { ...SAMPLES[type].valid, extra: true })).toThrow(ZodError)
  })

  it('rejects track.updated {} and settings.changed {} (at least one key)', () => {
    expect(() => parseEventPayload('track.updated', {})).toThrow(ZodError)
    expect(() => parseEventPayload('settings.changed', {})).toThrow(ZodError)
    // An explicitly undefined key is dropped by JSON.stringify, so it would store `{}` too.
    expect(() => parseEventPayload('track.updated', { includeBonus: undefined })).toThrow(ZodError)
    expect(() => parseEventPayload('settings.changed', { theme: undefined })).toThrow(ZodError)
  })

  it('accepts the optional-only payloads with one key', () => {
    expect(parseEventPayload('track.updated', { includeBonus: false })).toEqual({
      includeBonus: false,
    })
    expect(parseEventPayload('settings.changed', { shareNotesWithAi: true })).toEqual({
      shareNotesWithAi: true,
    })
  })

  it('checks the rules the table spells out', () => {
    const checkIn = { status: 'done', minutes: 0 }
    expect(parseEventPayload('block.checked_in', checkIn)).toEqual(checkIn)
    expect(() => parseEventPayload('block.checked_in', { ...checkIn, minutes: 1.5 })).toThrow(
      ZodError,
    )
    expect(() =>
      parseEventPayload('block.checked_in', { ...checkIn, note: 'a'.repeat(1001) }),
    ).toThrow(ZodError)
    expect(parseEventPayload('prompt.completed', {})).toEqual({})
    expect(() =>
      parseEventPayload('track.enrolled', {
        roadmapVariant: '10w',
        budgetMinutes: 245,
        startDate: '2026-09-25',
      }),
    ).toThrow(ZodError)
    expect(() =>
      parseEventPayload('schedule.changed', {
        timezone: 'Asia/Ho_Chi_Minh',
        dayStartsAt: '04:00',
        effectiveAt: '2026-09-25T04:00:00', // no offset
      }),
    ).toThrow(ZodError)
    expect(
      parseEventPayload('item.snapshot', { ...SAMPLES['item.snapshot'].valid, dueOn: null }),
    ).toMatchObject({ dueOn: null })
    expect(() => parseEventPayload('track.updated', { weeklyTemplate: ['sat', 'sun'] })).toThrow(
      ZodError,
    )
  })

  it('rejects a payload whose jsonb text exceeds MAX_PAYLOAD_BYTES even when Zod accepts it', () => {
    // 950 three-byte characters: within the 1000-character rule, but 2850 bytes of UTF-8.
    const payload = { status: 'done', minutes: 30, note: 'ệ'.repeat(950) }
    expect(EVENT_PAYLOADS['block.checked_in'].safeParse(payload).success).toBe(true)
    expect(() => parseEventPayload('block.checked_in', payload)).toThrow(ZodError)
    expect(() => parseEventPayload('block.checked_in', payload)).toThrow(/1900/)
  })

  it('keeps MAX_PAYLOAD_BYTES below the database limit of 2048 bytes', () => {
    expect(MAX_PAYLOAD_BYTES).toBe(1900)
    const ascii = { status: 'done', minutes: 30, note: 'a'.repeat(1000) }
    expect(parseEventPayload('block.checked_in', ascii)).toEqual(ascii)
  })

  it('measures the jsonb text, not JSON.stringify: nothing it accepts is rejected by the database', () => {
    const itemIds = (n: number) => ({ itemIds: Array.from({ length: n }, () => 'dsa:x') })
    // 235 ids: 1893 bytes of JSON.stringify, but 2128 bytes as payload::text (over 2048).
    expect(new TextEncoder().encode(JSON.stringify(itemIds(235))).length).toBe(1893)
    expect(jsonbTextBytes(itemIds(235))).toBe(2128)
    expect(() => parseEventPayload('plan.extra_added', itemIds(235))).toThrow(ZodError)
    // 210 ids: 1903 bytes as jsonb text, over the limit; 209 ids: 1894 bytes, accepted — and
    // 030-events inserts the same payload and checks octet_length(payload::text) = 1894.
    expect(() => parseEventPayload('plan.extra_added', itemIds(210))).toThrow(/1903/)
    expect(jsonbTextBytes(itemIds(209))).toBe(1894)
    expect(parseEventPayload('plan.extra_added', itemIds(209))).toEqual(itemIds(209))
  })

  it('jsonbTextBytes equals octet_length(payload::text) (values checked in 030-events)', () => {
    expect(jsonbTextBytes({})).toBe(2)
    expect(jsonbTextBytes({ a: [1, 2, 3] })).toBe('{"a": [1, 2, 3]}'.length)
    expect(
      jsonbTextBytes({
        budgetMinutes: 60,
        newPerDay: null,
        throttle: [
          { dueAbove: 30, newPerDay: 1 },
          { dueAbove: 80, newPerDay: 0 },
        ],
        weeklyTemplate: { sat: 90, days: ['mon', 'tue'] },
        includeBonus: true,
      }),
    ).toBe(199)
    // Multi-byte characters, escaped quotes, newline, tab, backslash and an astral character.
    expect(
      jsonbTextBytes({ status: 'done', minutes: 30, note: 'Ôn "two pointers"\nxong ệ\t\\ 😀' }),
    ).toBe(84)
  })

  it('rejects strings jsonb cannot store: U+0000 and unpaired surrogates', () => {
    const checkIn = { status: 'done', minutes: 30 }
    expect(() => parseEventPayload('block.checked_in', { ...checkIn, note: 'a\u0000b' })).toThrow(
      ZodError,
    )
    expect(() => parseEventPayload('block.checked_in', { ...checkIn, note: 'a\ud800b' })).toThrow(
      ZodError,
    )
    expect(() =>
      parseEventPayload('track.updated', { weeklyTemplate: { 'sat\u0000': 90 } }),
    ).toThrow(ZodError)
    expect(parseEventPayload('block.checked_in', { ...checkIn, note: 'xong 😀' })).toEqual({
      ...checkIn,
      note: 'xong 😀',
    })
  })

  it('throws on a type it does not know', () => {
    expect(() => parseEventPayload('constructor' as EventType, {})).toThrow(/unknown event type/i)
  })

  it('keeps each schema’s inferred payload type', () => {
    expectTypeOf<EventPayload<'track.enrolled'>>().toEqualTypeOf<{
      roadmapVariant: string
      budgetMinutes: number
      startDate: string
    }>()
    expectTypeOf(parseEventPayload('prompt.completed', {})).toEqualTypeOf<{
      selfRating?: 1 | 2 | 3 | undefined
    }>()
  })
})
