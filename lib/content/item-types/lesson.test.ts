import { describe, expect, it } from 'vitest'
import { lessonFrontmatterSchema, lessonType } from './lesson'

const pattern = {
  id: 'dsa:lesson-arrays-hashing',
  format: 'pattern',
  topic: 'arrays-hashing',
  title: 'Arrays & Hashing',
  anchor: 'dsa:lc-0001',
  practice: 'dsa:lc-0049',
}

function pathsOf(input: unknown): string[] {
  const result = lessonFrontmatterSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
}

describe('lessonFrontmatterSchema', () => {
  it('parses a pattern lesson and a deep-dive', () => {
    expect(lessonFrontmatterSchema.parse(pattern)).toEqual({ ...pattern, status: 'active' })
    const deepDive = {
      id: 'dsa:lesson-lc-0271-deep-dive',
      format: 'deep-dive',
      topic: 'arrays-hashing',
      title: 'Encode and Decode Strings, step by step',
      about: 'dsa:lc-0271',
      practice: 'dsa:lc-0049',
      status: 'draft',
    }
    expect(lessonFrontmatterSchema.parse(deepDive)).toEqual(deepDive)
  })

  it('rejects an unknown key and a missing title', () => {
    expect(pathsOf({ ...pattern, export: 'metadata' })).toEqual([''])
    expect(pathsOf({ ...pattern, title: undefined })).toEqual(['title'])
  })

  it('checks the ID, references and slugs', () => {
    expect(pathsOf({ ...pattern, id: 'dsa:arrays-hashing' })).toEqual(['id'])
    expect(pathsOf({ ...pattern, anchor: 'lc-0001' })).toEqual(['anchor'])
    expect(pathsOf({ ...pattern, format: 'Pattern' })).toEqual(['format'])
    expect(pathsOf({ ...pattern, topic: '' })).toEqual(['topic'])
  })
})

describe('lessonType', () => {
  it('is completion-only, without spaced repetition, costing estimates.lesson', () => {
    const lesson = lessonFrontmatterSchema.parse(pattern)
    expect(lessonType.type).toBe('lesson')
    expect(lessonType.outcomes).toEqual({})
    expect(lessonType.srs).toBe(false)
    expect(lessonType.estimateMinutes(lesson, { estimates: { lesson: 25 } }, 'new')).toBe(25)
    expect(() => lessonType.estimateMinutes(lesson, { estimates: {} }, 'new')).toThrow(
      /estimates\.lesson/,
    )
  })
})
