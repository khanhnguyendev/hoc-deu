import { describe, expect, it } from 'vitest'
import { CATALOG } from '@/.generated/catalog'
import type { SimInputs } from '@/lib/domain/plan/simInputs'
import { RULES_VERSION } from '@/lib/domain/rules'
import { canonicalJson, inputsHash, simInputs } from './inputs'

const INPUTS = simInputs(CATALOG)

/** Every problem the roadmap weeks reference: core, bonus and recap entries. */
const referenced = (inputs: SimInputs): Set<string> =>
  new Set(
    Object.values(inputs.roadmaps).flatMap((roadmap) =>
      roadmap.weeks.flatMap((week) => [
        ...week.core,
        ...week.bonus,
        ...week.recap.map((entry) => entry.item),
      ]),
    ),
  )

/** `value` with every object's keys in reverse order, recursively (arrays keep their order). */
function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .reverse()
        .map(([key, entry]) => [key, reverseKeys(entry)]),
    )
  }
  return value
}

describe('simInputs (real generated catalog)', () => {
  it('describes the DSA track under the current rules', () => {
    expect(INPUTS.trackId).toBe('dsa')
    expect(INPUTS.rulesVersion).toBe(RULES_VERSION)
    const dsa = CATALOG.tracks.find((track) => track.id === 'dsa')
    expect(INPUTS.srs).toEqual({
      intervals: dsa?.srs.intervals,
      relearnDays: dsa?.srs.relearnDays,
      masteredAfter: dsa?.srs.masteredAfter,
    })
    expect(INPUTS.review).toEqual(dsa?.review)
    expect(INPUTS.weeklyTemplate).toEqual(dsa?.weeklyTemplate)
    expect(INPUTS.defaults).toEqual(dsa?.defaults)
    expect(INPUTS.estimates).toEqual({
      lesson: dsa?.estimates.lesson,
      problem: dsa?.estimates.problem?.new,
    })
  })

  it('lists both DSA roadmaps, as the catalog has them', () => {
    expect(Object.keys(INPUTS.roadmaps).sort()).toEqual(['10w', '8w'])
    for (const [variant, roadmap] of Object.entries(INPUTS.roadmaps)) {
      expect(roadmap).toEqual(CATALOG.roadmaps.dsa?.[variant])
    }
  })

  it('has a difficulty and a topic for every problem the roadmaps reference, and no other', () => {
    const ids = referenced(INPUTS)
    expect(ids.size).toBeGreaterThan(80)
    expect(new Set(Object.keys(INPUTS.problems))).toEqual(ids)
    for (const id of ids) {
      const item = CATALOG.items[id]
      expect(item?.type).toBe('problem')
      expect(INPUTS.problems[id]).toEqual({
        difficulty: item?.type === 'problem' ? item.content.difficulty : undefined,
        topic: item?.topicId,
      })
    }
  })

  it('throws when a roadmap references a problem the catalog does not have', () => {
    const items = { ...CATALOG.items }
    delete items['dsa:lc-0001']
    expect(() => simInputs({ ...CATALOG, items })).toThrow(/dsa:lc-0001/)
  })
})

describe('inputsHash', () => {
  const hash = inputsHash(INPUTS)

  it('is a sha256 hex digest', () => {
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('does not depend on key order', () => {
    expect(inputsHash(reverseKeys(INPUTS) as SimInputs)).toBe(hash)
  })

  it('changes when one difficulty changes', () => {
    const current = INPUTS.problems['dsa:lc-0001']
    expect(current).toBeDefined()
    const changed: SimInputs = {
      ...INPUTS,
      problems: {
        ...INPUTS.problems,
        'dsa:lc-0001': { topic: current?.topic ?? '', difficulty: 'H' },
      },
    }
    expect(inputsHash(changed)).not.toBe(hash)
  })

  it('changes with the rules version', () => {
    expect(inputsHash({ ...INPUTS, rulesVersion: INPUTS.rulesVersion + 1 })).not.toBe(hash)
  })
})

describe('canonicalJson', () => {
  it('sorts object keys recursively and keeps array order', () => {
    expect(canonicalJson({ b: [3, { d: 1, c: 2 }], a: null })).toBe(
      '{"a":null,"b":[3,{"c":2,"d":1}]}',
    )
  })
})
