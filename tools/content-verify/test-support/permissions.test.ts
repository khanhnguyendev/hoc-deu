import { describe, expect, it } from 'vitest'
import { runsAsRoot } from './permissions'

describe('runsAsRoot', () => {
  it('is true for uid 0', () => {
    expect(runsAsRoot(() => 0)).toBe(true)
  })

  it('is false for a non-zero uid', () => {
    expect(runsAsRoot(() => 1000)).toBe(false)
  })

  it('is false when getuid is unavailable (Windows)', () => {
    // `runsAsRoot(undefined)` would fall back to the real `process.getuid` (the default
    // parameter), which is host-dependent — including true when this very suite runs as root
    // (the "Unit tests as root" CI step). Simulate the absent-getuid platform directly instead,
    // so this case stays green no matter who runs it.
    const original = process.getuid
    try {
      ;(process as { getuid?: () => number }).getuid = undefined
      expect(runsAsRoot()).toBe(false)
    } finally {
      process.getuid = original
    }
  })
})
