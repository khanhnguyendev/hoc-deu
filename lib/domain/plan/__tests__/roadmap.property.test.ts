/**
 * Property tests for the new-item queue and the roadmap week (platform design §5.3, task 4.4a):
 * arbitrary introduced subsets of `CATALOG` (any level, status and days), a few items made draft
 * or retired, with and without bonus problems.
 */
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { PlanCatalog } from '../../catalog'
import { ITEM_STATE_STATUSES, type ItemState } from '../../state'
import { coreItemsOfWeek, newQueue, roadmapWeek } from '../roadmap'
import { CATALOG, DSA_8W, ENGLISH_10W, itemState, statesOf, withItems } from './fixtures'

const RUNS = { numRuns: 500 }
const ITEM_IDS = Object.keys(CATALOG.items)
const DAYS = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']
const TRACKS = [
  { trackId: 'dsa', roadmap: DSA_8W },
  { trackId: 'english', roadmap: ENGLISH_10W },
]

const stateOf = (itemId: string): fc.Arbitrary<ItemState> =>
  fc
    .record({
      introducedOn: fc.constantFrom(...DAYS),
      level: fc.integer({ min: 0, max: 4 }),
      weak: fc.boolean(),
      status: fc.constantFrom(...ITEM_STATE_STATUSES),
      lastResultOn: fc.option(fc.constantFrom(...DAYS), { nil: null }),
    })
    .map(({ introducedOn, ...state }) => itemState(itemId, introducedOn, state))

/** Any subset of the catalog's items introduced (DSA sources unlock English derived cards). */
const itemsArb: fc.Arbitrary<Readonly<Record<string, ItemState>>> = fc
  .subarray(ITEM_IDS)
  .chain((ids) => fc.tuple(...ids.map(stateOf)))
  .map((states) => Object.freeze(statesOf(...states)))

/** `CATALOG` with up to three items made draft or retired. */
const catalogArb: fc.Arbitrary<PlanCatalog> = fc
  .subarray(ITEM_IDS, { maxLength: 3 })
  .chain((ids) =>
    fc.tuple(
      ...ids.map((id) =>
        fc.constantFrom('draft' as const, 'retired' as const).map((status) => [id, { status }]),
      ),
    ),
  )
  .map((changes) => withItems(CATALOG, Object.fromEntries(changes)))

describe.each(TRACKS)('$trackId roadmap', ({ trackId, roadmap }) => {
  it('newQueue lists every active, not-introduced core item once; nothing introduced, draft or retired; no duplicates', () => {
    fc.assert(
      fc.property(catalogArb, itemsArb, fc.boolean(), (catalog, items, includeBonus) => {
        const queue = newQueue({ trackId, roadmap, catalog, items, includeBonus })

        expect(new Set(queue).size).toBe(queue.length)
        for (const id of queue) {
          expect(items[id], `${id} is introduced`).toBeUndefined()
          expect(catalog.items[id]?.status, `${id} is not active`).toBe('active')
        }
        for (const id of roadmap.weeks.flatMap((week) => coreItemsOfWeek(week, catalog))) {
          if (catalog.items[id]?.status !== 'active' || items[id] !== undefined) continue
          expect(
            queue.filter((queued) => queued === id),
            `core item ${id}`,
          ).toHaveLength(1)
        }
      }),
      RUNS,
    )
  })

  it('roadmapWeek never decreases when one more item is introduced', () => {
    fc.assert(
      fc.property(
        catalogArb,
        itemsArb,
        fc.constantFrom(...ITEM_IDS),
        fc.constantFrom(...DAYS),
        (catalog, items, itemId, day) => {
          const before = Object.fromEntries(Object.entries(items).filter(([id]) => id !== itemId))
          const after = { ...before, [itemId]: itemState(itemId, day) }
          expect(roadmapWeek(roadmap, catalog, after)).toBeGreaterThanOrEqual(
            roadmapWeek(roadmap, catalog, before),
          )
        },
      ),
      RUNS,
    )
  })
})
