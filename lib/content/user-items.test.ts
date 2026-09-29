import { describe, expect, it } from 'vitest'
import { CATALOG as GENERATED } from '@/.generated/catalog'
import { buildPlan } from '@/lib/domain/plan/buildPlan'
import type { Enrollment } from '@/lib/domain/plan/types'
import type { ItemState } from '@/lib/domain/state'
import { toPlanCatalog } from './plan-catalog'
import {
  customItemId,
  isPlainText,
  jsonbTextBytes,
  parseCustomPayload,
  toCatalogItem,
  toPlanItem,
  userCatalogItems,
  userItemOf,
  withUserItems,
  type UserItemRow,
} from './user-items'

const BASE = toPlanCatalog(GENERATED)
const MANIFESTS = GENERATED.tracks
const DSA = MANIFESTS.find((track) => track.id === 'dsa')!
const ENGLISH = MANIFESTS.find((track) => track.id === 'english')!
const BOT_REF = '0123456789abcdef'

const CARD = {
  front: 'two-pointer invariant',
  back: 'Hai con trỏ giữ bất biến: đoạn giữa chưa xét',
}
const FILL_BLANK = {
  kind: 'fill-blank',
  instruction: { vi: 'Điền từ còn thiếu', en: 'Fill in the blank' },
  text: 'The deploy is on {{blank}} until the fix lands.',
  answers: ['hold'],
}
const RESPOND = {
  kind: 'respond',
  instruction: { vi: 'Trả lời quản lý', en: 'Reply to your manager' },
  text: 'Is the feature on track?',
  sampleAnswers: ['Mostly, but the API change adds a day.'],
  rubric: ['Nêu rõ lý do trễ'],
}
const REWRITE = { ...RESPOND, kind: 'rewrite', text: 'fix is done i think' }
const PROMPT = {
  instruction: { vi: 'Giải thích hash map bằng tiếng Anh', en: 'Explain a hash map in English' },
  rubric: ['Nói về độ phức tạp'],
}

const ctx = (trackId = 'english', topicId = 'standup', week = 3) => ({ trackId, topicId, week })

function row(slug: string, change: Partial<UserItemRow> = {}): UserItemRow {
  return {
    itemId: customItemId(BOT_REF, slug),
    itemType: 'flashcard',
    trackId: 'dsa',
    topicId: 'arrays-hashing',
    payload: { ...CARD, tags: [] },
    status: 'active',
    createdOn: '2026-09-28',
    ...change,
  }
}

describe('parseCustomPayload (decision 17a)', () => {
  it('accepts a card, stores it without the server-owned fields and with the defaults', () => {
    const parsed = parseCustomPayload('flashcard', CARD, ctx('dsa', 'arrays-hashing'))
    expect(parsed).toEqual({ ok: true, payload: { ...CARD, tags: [] } })
  })

  it('accepts an exercise of each kind, storing the roadmap week', () => {
    for (const payload of [FILL_BLANK, RESPOND, REWRITE]) {
      const parsed = parseCustomPayload('exercise', payload, ctx())
      expect(parsed.ok, payload.kind).toBe(true)
      if (!parsed.ok) continue
      expect(parsed.payload.week).toBe(3)
      expect(parsed.payload).not.toHaveProperty('topic')
      expect(parsed.payload).not.toHaveProperty('id')
      expect(parsed.payload).not.toHaveProperty('status')
    }
  })

  it('accepts a prompt, which becomes a repeatable custom-tagged prompt', () => {
    const parsed = parseCustomPayload('prompt', PROMPT, ctx('dsa', 'arrays-hashing'))
    expect(parsed).toEqual({ ok: true, payload: { ...PROMPT, lang: { rubric: 'vi' } } })
  })

  it.each([
    ['flashcard', { ...CARD, id: 'dsa:x' }, 'id'],
    ['flashcard', { ...CARD, status: 'active' }, 'status'],
    ['flashcard', { ...CARD, tier: 'core' }, 'tier'],
    ['flashcard', { ...CARD, origin: 'bot' }, 'origin'],
    ['flashcard', { ...CARD, createdByRun: 'run_2026-09-28' }, 'createdByRun'],
    ['exercise', { ...FILL_BLANK, week: 1 }, 'week'],
    ['exercise', { ...FILL_BLANK, topic: 'standup' }, 'topic'],
    ['prompt', { ...PROMPT, tag: 'weekend-task' }, 'tag'],
    ['prompt', { ...PROMPT, repeatable: false }, 'repeatable'],
  ] as const)('refuses a %s payload that sets %s', (type, payload, field) => {
    const parsed = parseCustomPayload(type, payload, ctx())
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.issues.join('\n')).toContain(field)
  })

  it('refuses what the repository schema refuses (an unknown key, a missing field, two blanks)', () => {
    expect(parseCustomPayload('flashcard', { ...CARD, week: 2 }, ctx()).ok).toBe(false)
    expect(parseCustomPayload('flashcard', { front: 'x' }, ctx()).ok).toBe(false)
    expect(
      parseCustomPayload('exercise', { ...FILL_BLANK, text: '{{blank}} and {{blank}}' }, ctx()).ok,
    ).toBe(false)
    expect(parseCustomPayload('prompt', { ...PROMPT, week: 2 }, ctx()).ok).toBe(false)
    expect(parseCustomPayload('prompt', 'not an object', ctx()).ok).toBe(false)
  })
})

describe('isPlainText (§6.4.4)', () => {
  it.each([
    '<b>bold</b>',
    'see https://example.com',
    'http://x.y',
    'go to www.example.com',
    'a\u0007b',
    'two\nlines',
    'x > y',
  ])('refuses %j', (value) => {
    expect(isPlainText(value)).toBe(false)
  })

  it.each([
    'ftp://files.example',
    'git+ssh://host/repo',
    'mailto:someone',
    'MAILTO:x',
    'xem leetcode.com',
    'docs trên react.dev nhé',
    'trang abc.vn',
    'EXAMPLE.ORG',
    'my-site.io',
    'fly.app',
    'x.co',
    'example.net',
  ])('refuses a link %j', (value) => {
    expect(isPlainText(value)).toBe(false)
  })

  it('accepts Vietnamese sentences with periods, numbers and abbreviations', () => {
    expect(isPlainText('Xong. Tiếp theo là Two Pointers. Độ phức tạp O(n).')).toBe(true)
    expect(isPlainText('Phiên bản 1.2.3, ví dụ: a.b, e.g. mảng; v.v.')).toBe(true)
    expect(isPlainText('Ngày 28.09.2026 họp lúc 9.30')).toBe(true)
  })

  it('accepts Vietnamese with diacritics, braces and punctuation', () => {
    expect(isPlainText('Hai con trỏ giữ bất biến — đoạn giữa chưa xét!')).toBe(true)
    expect(isPlainText('Điền {{blank}} vào chỗ trống: "on hold"')).toBe(true)
  })
})

describe('jsonbTextBytes (the table’s 2 KB check)', () => {
  it('counts the spaces Postgres prints after every colon and comma', () => {
    // {"a": 1, "b": [1, 2], "c": "ư"} — 'ư' is two bytes.
    expect(jsonbTextBytes({ a: 1, b: [1, 2], c: 'ư' })).toBe(
      new TextEncoder().encode('{"a": 1, "b": [1, 2], "c": "ư"}').byteLength,
    )
  })
})

describe('toCatalogItem', () => {
  it('renders a stored card under its own ID, localId the whole ID (decision 39)', () => {
    const item = toCatalogItem(row('ah-card'))
    expect(item).toMatchObject({
      id: 'user:0123456789abcdef:ah-card',
      type: 'flashcard',
      trackId: 'dsa',
      localId: 'user:0123456789abcdef:ah-card',
      topicId: 'arrays-hashing',
      status: 'active',
      title: CARD.front,
      week: null,
    })
    expect(item.content).toMatchObject({ ...CARD, tier: 'extended', derivedFrom: null })
  })

  it('a retired row reads as retired; a hidden one keeps its page as it was (it says "Đã ẩn")', () => {
    expect(toCatalogItem(row('a-card', { status: 'hidden' })).status).toBe('active')
    expect(toCatalogItem(row('b-card', { status: 'retired' })).status).toBe('retired')
    // The engine reads both as retired: out of queues and plans (decision 17).
    expect(toPlanItem(row('a-card', { status: 'hidden' }), DSA).status).toBe('retired')
  })

  it('keeps an exercise’s stored week and topic', () => {
    const parsed = parseCustomPayload('exercise', FILL_BLANK, ctx())
    if (!parsed.ok) throw new Error('fixture')
    const item = toCatalogItem(
      row('drill', {
        itemType: 'exercise',
        trackId: 'english',
        topicId: 'standup',
        payload: parsed.payload,
      }),
    )
    expect(item).toMatchObject({ type: 'exercise', week: 3, title: 'Điền từ còn thiếu' })
    expect(item.content).toMatchObject({ topic: 'standup', week: 3, kind: 'fill-blank' })
  })
})

describe('toPlanItem', () => {
  it('takes the estimates and the card SRS parameters from the manifest (§5.7 srs.byType)', () => {
    const item = toPlanItem(row('ah-card'), DSA)
    expect(item).toMatchObject({
      id: 'user:0123456789abcdef:ah-card',
      itemType: 'flashcard',
      trackId: 'dsa',
      topicId: 'arrays-hashing',
      status: 'active',
      week: null,
      deckId: null,
      tier: 'extended',
      srs: { intervals: [1, 3, 7, 14], relearnDays: 1, masteredAfter: 2 },
    })
    expect(item.minutes.new).toBe(1.5)
    expect(item.minutes.review).toBe(0.5)
  })

  it('reads a hidden row as retired, and an exercise has no SRS', () => {
    expect(toPlanItem(row('x-card', { status: 'hidden' }), DSA).status).toBe('retired')
    const parsed = parseCustomPayload('exercise', RESPOND, ctx())
    if (!parsed.ok) throw new Error('fixture')
    const exercise = toPlanItem(
      row('ex', {
        itemType: 'exercise',
        trackId: 'english',
        topicId: 'standup',
        payload: parsed.payload,
      }),
      ENGLISH,
    )
    expect(exercise).toMatchObject({ srs: null, week: null, minutes: { new: 5 } })
  })
})

describe('withUserItems (the catalog overlay, decision 17)', () => {
  const rows = [
    row('active-card'),
    row('hidden-card', { status: 'hidden' }),
    row('retired-card', { status: 'retired' }),
  ]

  it('adds active rows as active items, hidden and retired ones as retired', () => {
    const catalog = withUserItems(BASE, rows, MANIFESTS)
    expect(catalog.items['user:0123456789abcdef:active-card']?.status).toBe('active')
    expect(catalog.items['user:0123456789abcdef:hidden-card']?.status).toBe('retired')
    expect(catalog.items['user:0123456789abcdef:retired-card']?.status).toBe('retired')
    expect(catalog.items['dsa:lc-0001']).toBe(BASE.items['dsa:lc-0001'])
    expect(catalog.tracks).toBe(BASE.tracks)
  })

  it('keeps the registry items for lookups (userItemOf)', () => {
    const catalog = withUserItems(BASE, rows, MANIFESTS)
    expect(userItemOf(catalog, 'user:0123456789abcdef:active-card')?.title).toBe(CARD.front)
    expect(userItemOf(catalog, 'dsa:lc-0001')).toBeNull()
    expect(userItemOf(BASE, 'user:0123456789abcdef:active-card')).toBeNull()
  })

  it('is the catalog itself without rows, and never changes its input', () => {
    expect(withUserItems(BASE, [], MANIFESTS)).toBe(BASE)
    const before = Object.keys(BASE.items).length
    withUserItems(BASE, rows, MANIFESTS)
    expect(Object.keys(BASE.items)).toHaveLength(before)
  })

  it('leaves out a row of an unknown track and one whose payload no longer parses', () => {
    const catalog = withUserItems(
      BASE,
      [row('ghost', { trackId: 'nope' }), row('broken', { payload: { front: '' } })],
      MANIFESTS,
    )
    expect(Object.keys(catalog.items).filter((id) => id.startsWith('user:'))).toEqual([])
    expect(userCatalogItems([row('broken', { payload: { front: '' } })])).toEqual({})
  })

  it('the baseline plan never takes a custom card as new (§5.12), even with an empty new queue', () => {
    const custom = Array.from({ length: 5 }, (_, index) => row(`card-${index + 1}`))
    const catalog = withUserItems(BASE, custom, MANIFESTS)
    const enrollment: Enrollment = {
      trackId: 'dsa',
      variant: '8w',
      status: 'active',
      startDate: '2026-09-01',
      budgetMinutes: 60,
      newPerDay: null,
      throttle: [],
      weeklyTemplate: BASE.tracks.dsa!.weeklyTemplate,
      includeBonus: true,
      resetOn: null,
    }
    // Every repository item of the track introduced, none due: the new queue is empty.
    const items: Record<string, ItemState> = Object.fromEntries(
      Object.values(BASE.items)
        .filter((item) => item.trackId === 'dsa')
        .map((item) => [
          item.id,
          {
            itemId: item.id,
            trackId: 'dsa',
            topicId: item.topicId,
            itemType: item.itemType,
            level: 1,
            weak: false,
            topSuccesses: 0,
            status: 'ok' as const,
            dueOn: '2026-12-31',
            lastResult: 'solved',
            lastResultOn: '2026-09-20',
            introducedOn: '2026-09-20',
            lapses: 0,
            reps: 1,
          },
        ]),
    )
    for (const planDate of ['2026-09-28', '2026-10-03', '2026-10-04']) {
      for (const states of [items, {}]) {
        const plan = buildPlan({
          planDate,
          catalog,
          enrollments: [enrollment],
          items: states,
          recapDone: {},
        })
        const planned = plan.blocks.flatMap((block) => block.items.map((item) => item.itemId))
        expect(planned.filter((id) => id.startsWith('user:'))).toEqual([])
      }
    }
  })
})
