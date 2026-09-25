import { describe, expect, it } from 'vitest'
import {
  BLANK,
  EXERCISE_KINDS,
  exerciseSchema,
  exercisesFileSchema,
  exerciseType,
  gradeFillBlank,
} from './exercise'

/** §3.5's two examples. */
const fill = {
  id: 'english:ex-w01-fill-1',
  kind: 'fill-blank',
  week: 1,
  topic: 'standup',
  instruction: { vi: 'Điền từ còn thiếu', en: 'Fill in the blank' },
  text: "I'm {{blank}} on the API review — could someone help?",
  answers: ['blocked'],
  hint: "Từ này nghĩa là 'bị chặn, không làm tiếp được'.",
}

const rewrite = {
  id: 'english:ex-w01-rewrite-1',
  kind: 'rewrite',
  week: 1,
  topic: 'standup',
  instruction: { vi: 'Viết lại cho lịch sự và rõ ràng', en: 'Rewrite to sound polite and clear' },
  text: 'Your PR is wrong. Fix it.',
  sampleAnswers: [
    "Thanks for the PR! I think there's an issue in the retry logic — could you take a look?",
  ],
  rubric: ['polite opener', 'specific issue', 'clear ask'],
}

function pathsOf(input: unknown): string[] {
  const result = exerciseSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
}

describe('exercise kinds', () => {
  it('lists fill-blank, respond and rewrite', () => {
    expect(EXERCISE_KINDS).toEqual(['fill-blank', 'respond', 'rewrite'])
    expect(BLANK).toBe('{{blank}}')
  })

  it('parses the §3.5 examples as one exercises file', () => {
    const [first, second] = exercisesFileSchema.parse([fill, rewrite])
    expect(first).toEqual({ ...fill, status: 'active' })
    expect(second).toEqual({ ...rewrite, status: 'active' })
    expect(pathsOf({ ...rewrite, kind: 'respond', text: 'How was your weekend?' })).toEqual([])
  })

  it('a fill-blank text holds exactly one blank', () => {
    expect(pathsOf({ ...fill, text: "I'm blocked on the API review." })).toEqual(['text'])
    expect(pathsOf({ ...fill, text: 'I {{blank}} on the {{blank}}.' })).toEqual(['text'])
    expect(pathsOf({ ...fill, answers: [] })).toEqual(['answers'])
  })

  it('respond and rewrite need sample answers and a rubric', () => {
    expect(pathsOf({ ...rewrite, kind: 'respond', rubric: undefined })).toEqual(['rubric'])
    expect(pathsOf({ ...rewrite, sampleAnswers: [] })).toEqual(['sampleAnswers'])
    expect(pathsOf({ ...rewrite, answers: ['x'] })).toEqual([''])
  })

  it('rejects an unknown kind, a bad ID and an empty file', () => {
    expect(pathsOf({ ...fill, kind: 'choose' })).toEqual(['kind'])
    expect(pathsOf({ ...fill, id: 'english:w01-fill-1' })).toEqual(['id'])
    expect(exercisesFileSchema.safeParse([]).success).toBe(false)
  })
})

describe('gradeFillBlank (§3.5)', () => {
  it('passes a case- and whitespace-insensitive match', () => {
    expect(gradeFillBlank('  Blocked ', ['blocked'], false)).toBe('pass')
    expect(gradeFillBlank('on  call', ['On call'], false)).toBe('pass')
    expect(gradeFillBlank('ETA', ['eta', 'estimate'], false)).toBe('pass')
  })

  it('is close after the hint, a miss when wrong', () => {
    expect(gradeFillBlank('  Blocked ', ['blocked'], true)).toBe('close')
    expect(gradeFillBlank('block', ['blocked'], false)).toBe('miss')
    expect(gradeFillBlank('block', ['blocked'], true)).toBe('miss')
    expect(gradeFillBlank('', ['blocked'], false)).toBe('miss')
  })

  it('[RF-3] compares NFC-normalised text', () => {
    const decomposed = 'Café'
    const composed = 'Café'
    expect(decomposed).not.toBe(composed)
    expect(gradeFillBlank(decomposed, [composed], false)).toBe('pass')
    expect(gradeFillBlank(composed, [decomposed], false)).toBe('pass')
  })
})

describe('exerciseType', () => {
  it('maps pass / close / miss, without spaced repetition, costing estimates.exercise', () => {
    const exercise = exerciseSchema.parse(fill)
    expect(exerciseType.type).toBe('exercise')
    expect(exerciseType.outcomes).toEqual({ pass: 'success', close: 'partial', miss: 'fail' })
    expect(exerciseType.srs).toBe(false)
    expect(exerciseType.estimateMinutes(exercise, { estimates: { exercise: 5 } }, 'new')).toBe(5)
    expect(() => exerciseType.estimateMinutes(exercise, { estimates: {} }, 'new')).toThrow(
      /estimates\.exercise/,
    )
  })
})
