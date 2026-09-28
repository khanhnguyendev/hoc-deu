import { describe, expect, it } from 'vitest'
import { bodyHash } from '@/lib/bot/canonical'
import { catalogVersion, getCatalog } from './catalog'

describe('catalogVersion (§6.4.1, decision 21)', () => {
  it('is the generated catalog’s version: 16 hex digits of the SHA-256 of its canonical JSON', () => {
    expect(catalogVersion()).toMatch(/^[0-9a-f]{16}$/)
    expect(catalogVersion()).toBe(bodyHash(getCatalog()).slice(0, 16))
  })
})
