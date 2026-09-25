/**
 * A seeded pseudo-random generator (mulberry32) for the simulation (§5.10) and property tests:
 * the same seed gives the same sequence on every machine. Never `Math.random()` in `lib/domain`.
 */

/** Floats in [0, 1), deterministic for `seed` (any 32-bit integer). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
