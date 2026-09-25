import { describe, expect, it } from 'vitest'
import { promptSchema, promptsFileSchema, promptType } from './prompt'

const mockInterview = {
  id: 'dsa:prompt-mock-interview',
  tag: 'mock-interview',
  instruction: {
    vi: 'Chọn một bài Medium đã học lâu nhất chưa gặp lại, giải và giải thích bằng tiếng Anh.',
    en: 'Pick the Medium problem you have not seen for the longest; solve it and explain it aloud.',
  },
  rubric: ['clarifies the problem', 'states the complexity'],
  minutes: 45,
  repeatable: true,
}

const weekendTask = {
  id: 'english:prompt-w01-standup-update',
  tag: 'weekend-task',
  week: 1,
  instruction: { vi: 'Ghi âm cập nhật stand-up 1 phút', en: 'Record a 1-minute stand-up update' },
}

function pathsOf(input: unknown): string[] {
  const result = promptSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
}

describe('promptSchema', () => {
  it('parses a repeatable prompt and a weekly one', () => {
    expect(promptSchema.parse(mockInterview)).toEqual({
      ...mockInterview,
      lang: { rubric: 'vi' },
      status: 'active',
    })
    expect(promptsFileSchema.parse([weekendTask])).toEqual([
      { ...weekendTask, rubric: [], lang: { rubric: 'vi' }, repeatable: false, status: 'active' },
    ])
  })

  it('names the rubric language: Vietnamese unless it says English (M3-R5, WCAG 3.1.2)', () => {
    expect(promptSchema.parse(weekendTask).lang).toEqual({ rubric: 'vi' })
    expect(promptSchema.parse({ ...weekendTask, lang: { rubric: 'en' } }).lang).toEqual({
      rubric: 'en',
    })
    expect(pathsOf({ ...weekendTask, lang: { rubric: 'fr' } })).toEqual(['lang.rubric'])
    expect(pathsOf({ ...weekendTask, lang: { rubric: 'en', front: 'en' } })).toEqual(['lang'])
  })

  it('has a week exactly when it is not repeatable', () => {
    expect(pathsOf({ ...mockInterview, week: 3 })).toEqual(['week'])
    expect(pathsOf({ ...weekendTask, week: undefined })).toEqual(['week'])
  })

  it('checks the ID, tag and minutes', () => {
    expect(pathsOf({ ...weekendTask, id: 'english:w01-standup-update' })).toEqual(['id'])
    expect(pathsOf({ ...weekendTask, tag: 'Weekend' })).toEqual(['tag'])
    expect(pathsOf({ ...weekendTask, minutes: 0 })).toEqual(['minutes'])
    expect(promptsFileSchema.safeParse([]).success).toBe(false)
  })
})

describe('promptType', () => {
  it('is completion-only; its own minutes win over estimates.prompt', () => {
    expect(promptType.type).toBe('prompt')
    expect(promptType.outcomes).toEqual({})
    expect(promptType.srs).toBe(false)
    const estimates = { estimates: { prompt: 10 } }
    const withMinutes = promptSchema.parse(mockInterview)
    const withoutMinutes = promptSchema.parse(weekendTask)
    expect(promptType.estimateMinutes(withMinutes, estimates, 'new')).toBe(45)
    expect(promptType.estimateMinutes(withoutMinutes, estimates, 'new')).toBe(10)
    expect(promptType.estimateMinutes(withMinutes, { estimates: {} }, 'new')).toBe(45)
    expect(() => promptType.estimateMinutes(withoutMinutes, { estimates: {} }, 'new')).toThrow(
      /estimates\.prompt/,
    )
  })
})
