import { describe, expect, it } from 'vitest'
import { topologicalOrder } from './topological-order'

const input = {
  numCourses: 4,
  prerequisites: [
    [1, 0],
    [2, 0],
    [3, 1],
    [3, 2],
  ],
}

describe('topologicalOrder', () => {
  it('accepts a valid order', () => {
    expect(topologicalOrder(input, [0, 1, 2, 3], [0, 1, 2, 3])).toBe(true)
    expect(topologicalOrder(input, [0, 2, 1, 3], [0, 1, 2, 3])).toBe(true)
  })

  it('rejects an order that violates a prerequisite', () => {
    const result = topologicalOrder(input, [1, 0, 2, 3], [0, 1, 2, 3])
    expect(result).not.toBe(true)
    expect(typeof result).toBe('string')
  })

  it('rejects a course missing from actual', () => {
    const result = topologicalOrder(input, [0, 1, 2], [0, 1, 2, 3])
    expect(result).not.toBe(true)
  })

  it('accepts an empty actual when no valid order exists (a cycle)', () => {
    const cyclic = {
      numCourses: 2,
      prerequisites: [
        [0, 1],
        [1, 0],
      ],
    }
    expect(topologicalOrder(cyclic, [], [])).toBe(true)
  })

  it('rejects a non-empty actual when expected records a cycle', () => {
    const cyclic = {
      numCourses: 2,
      prerequisites: [
        [0, 1],
        [1, 0],
      ],
    }
    const result = topologicalOrder(cyclic, [0, 1], [])
    expect(result).not.toBe(true)
  })
})
