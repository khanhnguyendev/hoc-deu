import { describe, expect, it } from 'vitest'
import { levelFor } from './levels'

describe('levelFor (DESIGN_SYSTEM §3.4)', () => {
  it.each([
    [0, 0],
    [1, 1],
    [15, 1],
    [16, 2],
    [40, 2],
    [41, 3],
    [75, 3],
    [76, 4],
    [600, 4],
  ])('%i minutes → level %i', (minutes, level) => {
    expect(levelFor(minutes)).toBe(level)
  })
})
