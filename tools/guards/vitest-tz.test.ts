import { describe, expect, it } from 'vitest'

describe('vitest time zone pin', () => {
  it('runs with the fixed America/St_Johns time zone (vitest.config.ts, task 2.3)', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/St_Johns')
  })
})
