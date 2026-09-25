import { describe, expect, it } from 'vitest'
import { DSA_CARD_SRS, DSA_SRS, ENGLISH_SRS } from '../plan/__tests__/fixtures'
import type { SrsParams } from '../catalog'
import type { ItemStateStatus } from '../state'
import { addDays, type LocalDay } from '../time/localDay'
import { applyResult, NOT_STARTED, readd, srsStatus, type SrsState } from './applyResult'
import type { Outcome } from './outcomes'

const DAY: LocalDay = '2026-10-01'

/** `params.intervals[index]`, asserted present — the fixtures always have enough intervals. */
function intervalAt(params: SrsParams, index: number): number {
  const interval = params.intervals[index]
  if (interval === undefined) throw new Error(`fixture params has no interval[${index}]`)
  return interval
}

/** `NOT_STARTED` with the given fields overridden. */
function state(overrides: Partial<SrsState>): SrsState {
  return Object.freeze({ ...NOT_STARTED, ...overrides })
}

type Row = {
  readonly name: string
  readonly level: number
  readonly outcome: Outcome
  readonly weak?: boolean
  readonly topSuccesses?: number
  readonly lapses?: number
  readonly expectLevel: number
  readonly expectWeak: boolean
  readonly expectTopSuccesses: number
  readonly expectLapses: number
  readonly expectDueOn: LocalDay
  readonly expectStatus: Exclude<ItemStateStatus, 'skipped'>
}

/** Platform design §5.7's table, for one track's SRS parameters. */
function buildRows(params: SrsParams): readonly Row[] {
  const n = params.intervals.length
  return [
    {
      name: 'not started (L = 0) + success',
      level: 0,
      outcome: 'success',
      expectLevel: 1,
      expectWeak: false,
      expectTopSuccesses: 0,
      expectLapses: 0,
      expectDueOn: addDays(DAY, intervalAt(params, 0)),
      expectStatus: 'ok',
    },
    {
      name: 'not started (L = 0) + partial',
      level: 0,
      outcome: 'partial',
      expectLevel: 1,
      expectWeak: false,
      expectTopSuccesses: 0,
      expectLapses: 0,
      expectDueOn: addDays(DAY, intervalAt(params, 0)),
      expectStatus: 'ok',
    },
    {
      name: 'not started (L = 0) + fail: a first attempt is not a lapse',
      level: 0,
      outcome: 'fail',
      lapses: 2,
      expectLevel: 1,
      expectWeak: true,
      expectTopSuccesses: 0,
      expectLapses: 2,
      expectDueOn: addDays(DAY, params.relearnDays),
      expectStatus: 'weak',
    },
    {
      name: '1 <= L < N + success',
      level: 1,
      outcome: 'success',
      expectLevel: 2,
      expectWeak: false,
      expectTopSuccesses: 0,
      expectLapses: 0,
      expectDueOn: addDays(DAY, intervalAt(params, 1)),
      expectStatus: 'ok',
    },
    {
      name: 'L = N - 1 + success reaches the top level (topSuccesses unchanged, not mastery)',
      level: n - 1,
      outcome: 'success',
      expectLevel: n,
      expectWeak: false,
      expectTopSuccesses: 0,
      expectLapses: 0,
      expectDueOn: addDays(DAY, intervalAt(params, n - 1)),
      expectStatus: 'strong',
    },
    {
      name: 'L = N + success: topSuccesses + 1',
      level: n,
      outcome: 'success',
      topSuccesses: 0,
      expectLevel: n,
      expectWeak: false,
      expectTopSuccesses: 1,
      expectLapses: 0,
      expectDueOn: addDays(DAY, intervalAt(params, n - 1)),
      expectStatus: 'strong',
    },
    {
      name: 'L >= 1 + partial: level and lapses unchanged',
      level: 2,
      outcome: 'partial',
      lapses: 1,
      expectLevel: 2,
      expectWeak: false,
      expectTopSuccesses: 0,
      expectLapses: 1,
      expectDueOn: addDays(DAY, intervalAt(params, 1)),
      expectStatus: 'ok',
    },
    {
      name: 'L >= 1 + fail: lapses + 1',
      level: 2,
      outcome: 'fail',
      lapses: 1,
      expectLevel: 1,
      expectWeak: true,
      expectTopSuccesses: 0,
      expectLapses: 2,
      expectDueOn: addDays(DAY, params.relearnDays),
      expectStatus: 'weak',
    },
  ]
}

describe.each([
  ['DSA_SRS (problems)', DSA_SRS],
  ['ENGLISH_SRS', ENGLISH_SRS],
  ['DSA_CARD_SRS (flashcards)', DSA_CARD_SRS],
] satisfies (readonly [string, SrsParams])[])('applyResult — %s', (_label, params) => {
  it.each(buildRows(params))('$name', (row) => {
    const input = state({
      level: row.level,
      weak: row.weak ?? false,
      topSuccesses: row.topSuccesses ?? 0,
      lapses: row.lapses ?? 0,
      reps: 4,
      lastResultOn: '2026-09-20',
    })

    const result = applyResult(input, row.outcome, DAY, params)

    expect(result.level).toBe(row.expectLevel)
    expect(result.weak).toBe(row.expectWeak)
    expect(result.topSuccesses).toBe(row.expectTopSuccesses)
    expect(result.lapses).toBe(row.expectLapses)
    expect(result.dueOn).toBe(row.expectDueOn)
    expect(result.status).toBe(row.expectStatus)
    expect(result.reps).toBe(5)
    expect(result.lastResultOn).toBe(DAY)
  })
})

describe('applyResult — exact dates from the brief (DSA_SRS, from 2026-10-01)', () => {
  it('not started + success -> due 2026-10-08', () => {
    const result = applyResult(state({ lastResultOn: null }), 'success', DAY, DSA_SRS)
    expect(result).toMatchObject({
      level: 1,
      weak: false,
      dueOn: '2026-10-08',
      reps: 1,
      status: 'ok',
    })
  })

  it('L 2 + success -> level 3, due 2026-10-01 + 60, status strong', () => {
    const input = state({ level: 2, lastResultOn: '2026-09-20' })
    const result = applyResult(input, 'success', DAY, DSA_SRS)
    expect(result).toMatchObject({ level: 3, dueOn: '2026-11-30', status: 'strong' })
  })

  it('L 1 + fail -> level 1, weak, lapses + 1, due 2026-10-04, status weak', () => {
    const input = state({ level: 1, lapses: 0, lastResultOn: '2026-09-20' })
    const result = applyResult(input, 'fail', DAY, DSA_SRS)
    expect(result).toMatchObject({
      level: 1,
      weak: true,
      lapses: 1,
      dueOn: '2026-10-04',
      status: 'weak',
    })
  })
})

describe('applyResult — mastery (DSA_SRS, masteredAfter 2)', () => {
  it('first success at the top level leaves topSuccesses 1, status strong', () => {
    const input = state({ level: 3, topSuccesses: 0, lastResultOn: '2026-09-20' })
    const result = applyResult(input, 'success', '2026-10-01', DSA_SRS)
    expect(result).toMatchObject({ level: 3, topSuccesses: 1, status: 'strong' })
    expect(result.dueOn).not.toBeNull()
  })

  it('the second success on a different day masters the item: dueOn null', () => {
    const afterFirst = applyResult(
      state({ level: 3, topSuccesses: 0, lastResultOn: '2026-09-20' }),
      'success',
      '2026-10-01',
      DSA_SRS,
    )
    const result = applyResult(afterFirst, 'success', '2026-10-08', DSA_SRS)
    expect(result).toMatchObject({ level: 3, topSuccesses: 2, status: 'mastered', dueOn: null })
  })

  it('a partial on a mastered item keeps it mastered', () => {
    const mastered = state({
      level: 3,
      topSuccesses: 2,
      status: 'mastered',
      dueOn: null,
      lastResultOn: '2026-09-20',
    })
    const result = applyResult(mastered, 'partial', DAY, DSA_SRS)
    expect(result.status).toBe('mastered')
    expect(result.dueOn).toBeNull()
    expect(result.topSuccesses).toBe(2)
  })

  it('a fail on a mastered item -> level 1, weak, topSuccesses 0, lapses + 1, status weak', () => {
    const mastered = state({
      level: 3,
      topSuccesses: 2,
      status: 'mastered',
      dueOn: null,
      lapses: 0,
      lastResultOn: '2026-09-20',
    })
    const result = applyResult(mastered, 'fail', DAY, DSA_SRS)
    expect(result).toMatchObject({
      level: 1,
      weak: true,
      topSuccesses: 0,
      lapses: 1,
      status: 'weak',
    })
  })
})

describe('applyResult — weak flag is preserved, not recomputed, on a partial (DSA_SRS)', () => {
  it('stays false through a partial when it was false', () => {
    const input = state({ level: 2, weak: false, lastResultOn: '2026-09-20' })
    expect(applyResult(input, 'partial', DAY, DSA_SRS).weak).toBe(false)
  })

  it('stays true through a partial when it was true', () => {
    const input = state({ level: 2, weak: true, lastResultOn: '2026-09-20' })
    expect(applyResult(input, 'partial', DAY, DSA_SRS).weak).toBe(true)
  })
})

describe('applyResult — English (N = 4): level 3 and 4 are strong, level 1-2 are ok', () => {
  it.each([
    [1, 'ok'],
    [2, 'ok'],
    [3, 'strong'],
    [4, 'strong'],
  ] as const)('level %i -> %s', (level, expectedStatus) => {
    expect(srsStatus(level, false, 0, ENGLISH_SRS)).toBe(expectedStatus)
  })
})

describe('applyResult — first result per day (DSA_SRS)', () => {
  it.each(['success', 'partial', 'fail'] as const)(
    'a second result on the same day (%s) returns the identical object',
    (outcome) => {
      const input = state({ level: 1, lastResultOn: DAY })
      expect(applyResult(input, outcome, DAY, DSA_SRS)).toBe(input)
    },
  )
})

describe('applyResult — "today" is the result day, not the due date (DSA_SRS)', () => {
  it('an item due 2026-10-01 reviewed on 2026-10-05 with success from L1 -> due 2026-10-05 + 21', () => {
    const input = state({ level: 1, dueOn: '2026-10-01', lastResultOn: '2026-09-24' })
    const result = applyResult(input, 'success', '2026-10-05', DSA_SRS)
    expect(result.dueOn).toBe(addDays('2026-10-05', 21))
  })
})

describe('applyResult — level clamp (DSA_SRS, N = 3)', () => {
  it('level 5 + success -> level 3 (N), topSuccesses + 1', () => {
    const input = state({ level: 5, topSuccesses: 0, lastResultOn: '2026-09-20' })
    const result = applyResult(input, 'success', DAY, DSA_SRS)
    expect(result.level).toBe(3)
    expect(result.topSuccesses).toBe(1)
    expect(result.status).toBe('strong')
  })
})

describe('applyResult — purity: the input state is never modified', () => {
  it('a frozen input is untouched by applyResult', () => {
    const input = Object.freeze({
      ...NOT_STARTED,
      level: 1,
      lastResultOn: '2026-09-20',
    }) as SrsState
    const snapshot = { ...input }
    applyResult(input, 'success', DAY, DSA_SRS)
    expect(input).toEqual(snapshot)
  })

  it('a frozen input is untouched by readd', () => {
    const input = Object.freeze({
      ...NOT_STARTED,
      level: 3,
      topSuccesses: 2,
      status: 'mastered' as const,
      dueOn: null,
    }) as SrsState
    const snapshot = { ...input }
    readd(input, DAY, DSA_SRS)
    expect(input).toEqual(snapshot)
  })
})

describe('readd (§5.7 item.readded)', () => {
  it('a mastered DSA item on 2026-11-01 -> level 3, topSuccesses 0, dueOn 2026-11-01, status strong', () => {
    const mastered = state({
      level: 3,
      topSuccesses: 2,
      status: 'mastered',
      dueOn: null,
      lastResultOn: '2026-10-08',
      reps: 6,
    })
    const result = readd(mastered, '2026-11-01', DSA_SRS)
    expect(result).toMatchObject({
      level: 3,
      topSuccesses: 0,
      dueOn: '2026-11-01',
      status: 'strong',
      reps: 6,
      lastResultOn: '2026-10-08',
    })
  })

  it('is not a result: lastResultOn and reps are unchanged', () => {
    const mastered = state({
      level: 3,
      topSuccesses: 2,
      status: 'mastered',
      dueOn: null,
      lastResultOn: '2026-10-08',
      reps: 6,
    })
    const result = readd(mastered, '2026-11-01', DSA_SRS)
    expect(result.lastResultOn).toBe(mastered.lastResultOn)
    expect(result.reps).toBe(mastered.reps)
  })

  it('a non-mastered state is returned unchanged (the same object)', () => {
    const input = state({ level: 2, status: 'ok', lastResultOn: '2026-10-08' })
    expect(readd(input, '2026-11-01', DSA_SRS)).toBe(input)
  })

  it.each(['weak', 'ok', 'strong', 'skipped'] as const)(
    'status %s is not mastered: returned unchanged',
    (status) => {
      const input = state({ level: 1, status, lastResultOn: '2026-10-08' })
      expect(readd(input, '2026-11-01', DSA_SRS)).toBe(input)
    },
  )
})

describe('srsStatus (§5.7 truth table)', () => {
  it('weak wins over everything else, even a mastery-eligible level and topSuccesses', () => {
    expect(srsStatus(3, true, 5, DSA_SRS)).toBe('weak')
  })

  it('mastered needs level >= N and topSuccesses >= masteredAfter', () => {
    expect(srsStatus(3, false, 2, DSA_SRS)).toBe('mastered')
    expect(srsStatus(3, false, 1, DSA_SRS)).toBe('strong')
    expect(srsStatus(2, false, 2, DSA_SRS)).toBe('ok')
  })

  it('strong needs level >= 3 (and not weak or mastered)', () => {
    expect(srsStatus(3, false, 0, DSA_SRS)).toBe('strong')
    expect(srsStatus(2, false, 0, DSA_SRS)).toBe('ok')
  })

  it('everything else is ok', () => {
    expect(srsStatus(0, false, 0, DSA_SRS)).toBe('ok')
    expect(srsStatus(1, false, 0, DSA_SRS)).toBe('ok')
  })
})
