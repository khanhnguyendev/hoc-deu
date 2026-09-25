import { describe, expect, it } from 'vitest'
import type { TrackEstimates } from '../schemas/manifest'
import {
  DIFFICULTIES,
  noteFrontmatterSchema,
  problemSchema,
  problemType,
  type Problem,
} from './problem'

/** §3.5's example problem. */
const lc271 = {
  id: 'dsa:lc-0271',
  leetcode: 271,
  title: 'Encode and Decode Strings',
  difficulty: 'M',
  topic: 'arrays-hashing',
  premium: true,
  alternatives: [{ label: 'LintCode 659 (free)', url: 'https://www.lintcode.com/problem/659/' }],
}

const twoSum = {
  id: 'dsa:lc-0001',
  leetcode: 1,
  title: 'Two Sum',
  difficulty: 'E',
  topic: 'arrays-hashing',
}

function pathsOf(input: unknown): string[] {
  const result = problemSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
}

const estimates: TrackEstimates = {
  estimates: { problem: { new: { E: 20, M: 35, H: 50 } } },
  review: { recallMinutes: 5, redoFactor: 0.6 },
}

describe('problemSchema', () => {
  it('parses the §3.5 example and fills the defaults', () => {
    expect(problemSchema.parse(lc271)).toEqual({ ...lc271, status: 'active' })
    expect(problemSchema.parse(twoSum)).toEqual({
      ...twoSum,
      premium: false,
      alternatives: [],
      status: 'active',
    })
  })

  it('requires a free alternative for a premium problem', () => {
    expect(pathsOf({ ...lc271, alternatives: [] })).toEqual(['alternatives'])
    expect(pathsOf({ ...lc271, alternatives: undefined })).toEqual(['alternatives'])
  })

  it('accepts only https links', () => {
    const http = [{ label: 'LintCode', url: 'http://www.lintcode.com/problem/659/' }]
    expect(pathsOf({ ...lc271, alternatives: http })).toEqual(['alternatives.0.url'])
    const script = [{ label: 'x', url: 'javascript:alert(1)' }]
    expect(pathsOf({ ...lc271, alternatives: script })).toEqual(['alternatives.0.url'])
  })

  it('ties the ID to the LeetCode number', () => {
    expect(pathsOf({ ...twoSum, id: 'dsa:lc-0002' })).toEqual(['id'])
    expect(pathsOf({ ...twoSum, id: 'dsa:lc-1' })).toEqual(['id'])
    expect(pathsOf({ ...twoSum, leetcode: 0 })).toEqual(['leetcode'])
    expect(pathsOf({ ...twoSum, leetcode: 100000 })).toEqual(['leetcode'])
  })

  it('rejects an unknown difficulty, an empty title and unknown keys', () => {
    expect(DIFFICULTIES).toEqual(['E', 'M', 'H'])
    expect(pathsOf({ ...twoSum, difficulty: 'X' })).toEqual(['difficulty'])
    expect(pathsOf({ ...twoSum, title: '  ' })).toEqual(['title'])
    expect(pathsOf({ ...twoSum, statement: 'Given an array…' })).toEqual([''])
    expect(pathsOf({ ...twoSum, status: 'hidden' })).toEqual(['status'])
    expect(pathsOf({ ...twoSum, topic: 'Arrays' })).toEqual(['topic'])
  })

  it('accepts bot provenance', () => {
    const bot = { ...twoSum, origin: 'bot', createdByRun: 'run_2026-10-01' }
    expect(pathsOf(bot)).toEqual([])
    expect(pathsOf({ ...bot, createdByRun: 'run_2026-10-01-2' })).toEqual([])
    expect(pathsOf({ ...bot, createdByRun: 'run_yesterday' })).toEqual(['createdByRun'])
    expect(pathsOf({ ...bot, origin: 'human' })).toEqual(['origin'])
  })
})

describe('noteFrontmatterSchema', () => {
  it('holds only a status and provenance', () => {
    expect(noteFrontmatterSchema.parse({})).toEqual({ status: 'active' })
    expect(noteFrontmatterSchema.parse({ status: 'draft' })).toEqual({ status: 'draft' })
    expect(noteFrontmatterSchema.safeParse({ title: 'x' }).success).toBe(false)
  })
})

describe('problemType', () => {
  const medium = problemSchema.parse({ ...lc271 }) satisfies Problem
  const hard = problemSchema.parse({ ...twoSum, difficulty: 'H' })

  it('maps outcomes and uses spaced repetition', () => {
    expect(problemType.type).toBe('problem')
    expect(problemType.outcomes).toEqual({ solved: 'success', hint: 'partial', failed: 'fail' })
    expect(problemType.srs).toBe(true)
  })

  it('estimates each mode from the manifest (§5.4, decision 12)', () => {
    expect(problemType.estimateMinutes(medium, estimates, 'new')).toBe(35)
    expect(problemType.estimateMinutes(medium, estimates, 'recall')).toBe(5)
    expect(problemType.estimateMinutes(medium, estimates, 'review')).toBe(5)
    expect(problemType.estimateMinutes(medium, estimates, 'redo')).toBe(21)
    expect(problemType.estimateMinutes(medium, estimates, 'explain-aloud')).toBe(5)
    expect(problemType.estimateMinutes(hard, estimates, 'new')).toBe(50)
    expect(problemType.estimateMinutes(hard, estimates, 'redo')).toBe(30)
  })

  it('throws when the track has no problem estimates', () => {
    expect(() => problemType.estimateMinutes(medium, { estimates: {} }, 'new')).toThrow(
      /estimates\.problem/,
    )
    expect(() =>
      problemType.estimateMinutes(medium, { estimates: estimates.estimates }, 'recall'),
    ).toThrow(/review/)
  })
})
