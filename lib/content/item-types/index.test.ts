import { describe, expect, it } from 'vitest'
import { ITEM_TYPES, type ItemType } from '../schemas/common'
import { getItemTypeCore, ITEM_TYPE_CORES } from './index'

/** One valid authored entry per item type. */
const SAMPLES: Record<ItemType, Record<string, unknown>> = {
  problem: {
    id: 'dsa:lc-0001',
    leetcode: 1,
    title: 'Two Sum',
    difficulty: 'E',
    topic: 'arrays-hashing',
  },
  lesson: {
    id: 'dsa:lesson-arrays-hashing',
    format: 'pattern',
    topic: 'arrays-hashing',
    title: 'Arrays & Hashing',
    anchor: 'dsa:lc-0001',
    practice: 'dsa:lc-0049',
  },
  flashcard: { id: 'english:w01-blocker', tier: 'core', front: 'blocker', back: 'vấn đề chặn' },
  exercise: {
    id: 'english:ex-w01-fill-1',
    kind: 'fill-blank',
    week: 1,
    topic: 'standup',
    instruction: { vi: 'Điền từ còn thiếu', en: 'Fill in the blank' },
    text: "I'm {{blank}} on the API review.",
    answers: ['blocked'],
  },
  prompt: {
    id: 'english:prompt-w01-standup-update',
    tag: 'weekend-task',
    week: 1,
    instruction: { vi: 'Ghi âm cập nhật stand-up', en: 'Record a stand-up update' },
  },
}

describe('ITEM_TYPE_CORES', () => {
  it('has a core for every item type, under its own key', () => {
    expect(Object.keys(ITEM_TYPE_CORES).sort()).toEqual([...ITEM_TYPES].sort())
    for (const type of ITEM_TYPES) {
      expect(ITEM_TYPE_CORES[type].type).toBe(type)
      expect(getItemTypeCore(type)).toBe(ITEM_TYPE_CORES[type])
    }
  })

  it('uses spaced repetition exactly for problems and flashcards', () => {
    const srsTypes = ITEM_TYPES.filter((type) => ITEM_TYPE_CORES[type].srs)
    expect(srsTypes).toEqual(['problem', 'flashcard'])
  })

  it('maps every outcome to success, partial or fail', () => {
    for (const type of ITEM_TYPES) {
      for (const outcome of Object.values(ITEM_TYPE_CORES[type].outcomes)) {
        expect(['success', 'partial', 'fail']).toContain(outcome)
      }
    }
  })

  it('throws for an unknown item type', () => {
    expect(() => getItemTypeCore('video' as ItemType)).toThrow(/video/)
  })
})

describe.each(ITEM_TYPES)('%s provenance (decision 26)', (type) => {
  const schema = ITEM_TYPE_CORES[type].schema
  const sample = SAMPLES[type]

  it('parses the sample, defaulting status to active', () => {
    const parsed = schema.parse(sample) as { status: string }
    expect(parsed.status).toBe('active')
  })

  it('accepts origin: bot with a createdByRun', () => {
    expect(
      schema.safeParse({ ...sample, origin: 'bot', createdByRun: 'run_2026-10-01' }).success,
    ).toBe(true)
    expect(schema.safeParse({ ...sample, origin: 'bot' }).success).toBe(true)
  })

  it('rejects createdByRun without origin', () => {
    const result = schema.safeParse({ ...sample, createdByRun: 'run_2026-10-01' })
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['origin'])
  })
})
