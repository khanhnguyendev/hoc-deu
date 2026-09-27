import { describe, expect, it } from 'vitest'
import { getCatalog } from '@/lib/content/catalog'
import { toPlanCatalog } from '@/lib/content/plan-catalog'
import { planCatalog } from './catalog'

describe('planCatalog', () => {
  it("is the engine's view of the generated catalog, built once per process", () => {
    const catalog = planCatalog()
    expect(planCatalog()).toBe(catalog)
    expect(catalog).toEqual(toPlanCatalog(getCatalog()))
    expect(Object.keys(catalog.tracks).sort()).toEqual(
      getCatalog()
        .tracks.map((track) => track.id)
        .sort(),
    )
  })
})
