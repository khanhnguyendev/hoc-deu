import { describe, expect, it } from 'vitest'
import { mulberry32 } from './random'

describe('mulberry32', () => {
  it('gives the pinned sequence for seed 1 (the simulation and its thresholds depend on it)', () => {
    const next = mulberry32(1)
    expect([next(), next(), next()]).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522,
    ])
  })

  it('gives the same sequence for the same seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 100; i += 1) expect(a()).toBe(b())
  })

  it('draws every value in [0, 1)', () => {
    for (const seed of [0, 1, 199, -1, 0xffffffff]) {
      const next = mulberry32(seed)
      const values = Array.from({ length: 10_000 }, () => next())
      expect(values.filter((value) => !(value >= 0 && value < 1))).toEqual([])
    }
  })
})
