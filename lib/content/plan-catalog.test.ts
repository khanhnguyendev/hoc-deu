import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { CATALOG as GENERATED_CATALOG } from '@/.generated/catalog'
import { throttleRulesSchema, type ItemMode } from '@/lib/domain/catalog'
import { EVENT_PAYLOADS } from '@/lib/domain/events'
import type { Enrollment } from '@/lib/domain/plan/types'
import { RESULT_OUTCOMES, type ResultName } from '@/lib/domain/srs/outcomes'
import type { Catalog, CatalogItem } from './catalog-types'
import { ITEM_TYPE_CORES, type Mode } from './item-types'
import { toEnrollment, toPlanCatalog, type EnrollmentInput } from './plan-catalog'
import type { ItemStatus } from './schemas/common'
import { trackManifestSchema, type TrackManifest } from './schemas/manifest'

// -------------------------------------------------------------------------------------------
// toPlanCatalog, on the real generated catalog
// -------------------------------------------------------------------------------------------

const PLAN_CATALOG = toPlanCatalog(GENERATED_CATALOG)

describe('toPlanCatalog (real generated catalog)', () => {
  it('maps every catalog item', () => {
    expect(Object.keys(PLAN_CATALOG.items).sort()).toEqual(
      Object.keys(GENERATED_CATALOG.items).sort(),
    )
  })

  it('gives every item a positive number of minutes in every mode', () => {
    for (const item of Object.values(PLAN_CATALOG.items)) {
      for (const minutes of Object.values(item.minutes)) {
        expect(minutes).toBeGreaterThan(0)
      }
    }
  })

  it('resolves dsa:lc-0001 (an Easy problem)', () => {
    const item = PLAN_CATALOG.items['dsa:lc-0001']
    expect(item).toBeDefined()
    expect(item?.minutes).toEqual({ new: 20, recall: 5, redo: 12, review: 5, 'explain-aloud': 5 })
    expect(item?.srs).toEqual({ intervals: [7, 21, 60], relearnDays: 3, masteredAfter: 2 })
    expect(item?.reviewModes).toBe(true)
    expect(item?.difficulty).toBe('E')
  })

  it('resolves an authored English card', () => {
    const card = Object.values(PLAN_CATALOG.items).find(
      (item) =>
        item.trackId === 'english' && item.itemType === 'flashcard' && item.derivedFrom === null,
    )
    expect(card).toBeDefined()
    expect(card?.srs).toEqual({ intervals: [1, 3, 7, 14], relearnDays: 1, masteredAfter: 2 })
    expect(card?.minutes.new).toBe(1.5)
  })

  it('resolves a derived card (Explaining code, from dsa:lc-0001)', () => {
    const card = PLAN_CATALOG.items['english:explaining-code:dsa:lc-0001']
    expect(card).toBeDefined()
    expect(card?.tier).toBe('derived')
    expect(card?.derivedFrom).toBe('dsa:lc-0001')
  })

  it('resolves dsa:lesson-arrays-hashing (a pattern lesson, no about)', () => {
    const lesson = PLAN_CATALOG.items['dsa:lesson-arrays-hashing']
    expect(lesson).toBeDefined()
    expect(lesson?.about).toBeNull()
    expect(lesson?.minutes.new).toBe(25)
  })

  it('resolves the mock interview prompt', () => {
    const prompt = PLAN_CATALOG.items['dsa:prompt-mock-interview']
    expect(prompt).toBeDefined()
    expect(prompt?.tag).toBe('mock-interview')
    expect(prompt?.repeatable).toBe(true)
    expect(prompt?.minutes.new).toBe(45)
  })

  it("carries both tracks' roadmaps", () => {
    expect(Object.keys(PLAN_CATALOG.tracks.dsa?.roadmaps ?? {}).sort()).toEqual(
      ['10w', '8w'].sort(),
    )
    expect(Object.keys(PLAN_CATALOG.tracks.english?.roadmaps ?? {})).toEqual(['10w'])
  })

  it("keeps english:deck-w01-standup's cardIds starting with the deck file's first card", () => {
    const deck = PLAN_CATALOG.decks['english:deck-w01-standup']
    const source = GENERATED_CATALOG.decks['english:deck-w01-standup']
    expect(deck).toBeDefined()
    expect(source?.cardIds[0]).toBeDefined()
    expect(deck?.cardIds[0]).toBe(source?.cardIds[0])
  })

  it('lists authored decks only (a derived deck is not listed)', () => {
    expect(GENERATED_CATALOG.decks['english:explaining-code']?.kind).toBe('derived')
    expect(PLAN_CATALOG.decks['english:explaining-code']).toBeUndefined()
  })
})

// -------------------------------------------------------------------------------------------
// toPlanCatalog, hand-built fixtures
// -------------------------------------------------------------------------------------------

function manifest(overrides: Partial<TrackManifest> = {}): TrackManifest {
  return {
    id: 'dsa',
    status: 'active',
    title: { vi: 'DSA', en: 'DSA' },
    accent: 'track-1',
    itemTypes: ['problem', 'flashcard', 'lesson'],
    codeLanguages: ['python'],
    srs: { intervals: [7, 21, 60], relearnDays: 3, masteredAfter: 2 },
    review: { recallMinutes: 5, redoFactor: 0.6 },
    topics: [],
    defaults: { budgetMinutes: 60, newPerDay: null, throttle: [] },
    estimates: {
      problem: { new: { E: 20, M: 35, H: 50 } },
      flashcard: { new: 1, review: 0.5 },
      lesson: 25,
    },
    decks: [],
    roadmaps: [{ id: '8w' }],
    weeklyTemplate: {},
    ...overrides,
  } as TrackManifest
}

function flashcardItem(id: string, trackId: string): CatalogItem<'flashcard'> {
  return {
    id,
    type: 'flashcard',
    trackId,
    localId: id.split(':').slice(1).join(':'),
    topicId: null,
    week: null,
    status: 'active',
    title: 'front',
    source: 'content/tracks/dsa/decks/w1.yaml',
    content: {
      id,
      tier: 'core',
      front: 'front',
      back: 'back',
      tags: [],
      status: 'active',
      deckId: 'dsa:deck-w1',
      lang: { front: 'en', back: 'vi', hint: 'vi' },
      derivedFrom: null,
    },
  }
}

function emptyCatalog(
  tracks: readonly TrackManifest[],
  items: Record<string, CatalogItem>,
): Catalog {
  return {
    schemaVersion: 1,
    tracks: [...tracks],
    roadmaps: {},
    missingRoadmaps: [],
    decks: {},
    items,
    coverage: {},
  }
}

describe('toPlanCatalog (hand-built fixtures)', () => {
  it('a DSA card inherits the base srs fields not in srs.byType.flashcard', () => {
    const dsaManifest = manifest({
      srs: {
        intervals: [7, 21, 60],
        relearnDays: 3,
        masteredAfter: 2,
        byType: { flashcard: { intervals: [1, 3, 7, 14], relearnDays: 1 } },
      },
    })
    const catalog = emptyCatalog([dsaManifest], {
      'dsa:card-1': flashcardItem('dsa:card-1', 'dsa'),
    })

    const result = toPlanCatalog(catalog)

    expect(result.items['dsa:card-1']?.srs).toEqual({
      intervals: [1, 3, 7, 14],
      relearnDays: 1,
      masteredAfter: 2, // inherited: srs.byType.flashcard does not set it
    })
  })

  function problemItem(id: string, trackId: string): CatalogItem<'problem'> {
    return {
      id,
      type: 'problem',
      trackId,
      localId: id.split(':').slice(1).join(':'),
      topicId: 'arrays-hashing',
      week: null,
      status: 'active',
      title: 'Two Sum',
      source: 'content/tracks/dsa/problems/lc-0001-two-sum/problem.yaml',
      content: {
        id,
        leetcode: 1,
        title: 'Two Sum',
        difficulty: 'E',
        topic: 'arrays-hashing',
        premium: false,
        alternatives: [],
        status: 'active',
        slug: 'two-sum',
        url: 'https://leetcode.com/problems/two-sum/',
        note: null, // no note
      },
    }
  }

  function deepDiveLesson(
    id: string,
    trackId: string,
    about: string,
    status: ItemStatus,
  ): CatalogItem<'lesson'> {
    return {
      id,
      type: 'lesson',
      trackId,
      localId: id.split(':').slice(1).join(':'),
      topicId: 'arrays-hashing',
      week: null,
      status,
      title: 'Deep dive: Two Sum',
      source: 'content/tracks/dsa/lessons/deep-dive-two-sum.mdx',
      content: {
        id,
        format: 'deep-dive',
        topic: 'arrays-hashing',
        title: 'Deep dive: Two Sum',
        about,
        status,
        mdxKey: id,
        sections: [],
      },
    }
  }

  it("finds a problem's deep-dive lesson even without a note, whatever the lesson's status", () => {
    const dsaManifest = manifest()
    const catalog = emptyCatalog([dsaManifest], {
      'dsa:lc-0001': problemItem('dsa:lc-0001', 'dsa'),
      'dsa:lesson-deep-dive-two-sum': deepDiveLesson(
        'dsa:lesson-deep-dive-two-sum',
        'dsa',
        'dsa:lc-0001',
        'draft', // a draft lesson too: the engine checks the status, not this adapter
      ),
    })

    const result = toPlanCatalog(catalog)

    expect(result.items['dsa:lc-0001']?.deepDiveId).toBe('dsa:lesson-deep-dive-two-sum')
  })
})

// -------------------------------------------------------------------------------------------
// Outcome sync (decision 4): RESULT_OUTCOMES ↔ the item-type cores' own `outcomes`
// -------------------------------------------------------------------------------------------

describe('outcome sync', () => {
  const srsCores = Object.values(ITEM_TYPE_CORES).filter((core) => core.srs)

  it('every srs-enabled core outcome equals RESULT_OUTCOMES[name]', () => {
    for (const core of srsCores) {
      for (const [name, outcome] of Object.entries(core.outcomes)) {
        expect(RESULT_OUTCOMES[name as ResultName]).toBe(outcome)
      }
    }
  })

  it('every RESULT_OUTCOMES name belongs to an srs-enabled core', () => {
    const covered = new Set(srsCores.flatMap((core) => Object.keys(core.outcomes)))
    for (const name of Object.keys(RESULT_OUTCOMES)) {
      expect(covered.has(name)).toBe(true)
    }
  })

  it('ItemMode (domain) and Mode (content) have the same members', () => {
    expectTypeOf<ItemMode>().toEqualTypeOf<Mode>()
  })
})

// -------------------------------------------------------------------------------------------
// toEnrollment
// -------------------------------------------------------------------------------------------

function enrollmentInput(overrides: Partial<EnrollmentInput> = {}): EnrollmentInput {
  return {
    trackId: 'english',
    roadmapVariant: '10w',
    status: 'active',
    startDate: '2026-09-28',
    budgetMinutes: 25,
    newPerDay: null,
    throttle: null,
    weeklyTemplate: null,
    includeBonus: false,
    resetOn: null,
    ...overrides,
  }
}

describe('toEnrollment', () => {
  it('resolves a null newPerDay to the track default (English → 8)', () => {
    const result = toEnrollment(enrollmentInput(), PLAN_CATALOG)
    expect(result?.newPerDay).toBe(8)
  })

  it('resolves a null newPerDay to the track default (DSA → null)', () => {
    const result = toEnrollment(
      enrollmentInput({ trackId: 'dsa', roadmapVariant: '8w' }),
      PLAN_CATALOG,
    )
    expect(result?.newPerDay).toBeNull()
  })

  it('falls back to the track throttle when the stored one is malformed', () => {
    const result = toEnrollment(enrollmentInput({ throttle: [{ dueAbove: 'x' }] }), PLAN_CATALOG)
    expect(result?.throttle).toEqual(PLAN_CATALOG.tracks.english?.defaults.throttle)
  })

  it('falls back to the track weekly template when the stored one is malformed', () => {
    const result = toEnrollment(
      enrollmentInput({ weeklyTemplate: { mon: [{ kind: 'nap' }] } }),
      PLAN_CATALOG,
    )
    expect(result?.weeklyTemplate).toEqual(PLAN_CATALOG.tracks.english?.weeklyTemplate)
  })

  it('falls back to the track throttle when the stored one is null', () => {
    const result = toEnrollment(enrollmentInput({ throttle: null }), PLAN_CATALOG)
    expect(result?.throttle).toEqual(PLAN_CATALOG.tracks.english?.defaults.throttle)
  })

  it.each([
    ['a practice block of 601 minutes', { kind: 'practice', tag: 'weekend-task', minutes: 601 }],
    ['a review block capped at 601 minutes', { kind: 'review', maxMinutes: 601 }],
  ])('falls back to the track weekly template for %s (M-4: no unstorable plan)', (_, block) => {
    const result = toEnrollment(
      enrollmentInput({ weeklyTemplate: { 'mon-fri': [{ kind: 'new' }], sun: [block] } }),
      PLAN_CATALOG,
    )
    expect(result?.weeklyTemplate).toEqual(PLAN_CATALOG.tracks.english?.weeklyTemplate)
  })

  it('keeps a custom weekly template at the 600-minute bound', () => {
    const custom = {
      sat: [{ kind: 'review', maxMinutes: 600 }],
      sun: [{ kind: 'practice', tag: 'weekend-task', minutes: 600 }],
    }
    const result = toEnrollment(enrollmentInput({ weeklyTemplate: custom }), PLAN_CATALOG)
    expect(result?.weeklyTemplate).toEqual(custom)
  })

  it('keeps a valid custom weekly template', () => {
    const custom = { sun: [{ kind: 'review' }] }
    const result = toEnrollment(enrollmentInput({ weeklyTemplate: custom }), PLAN_CATALOG)
    expect(result?.weeklyTemplate).toEqual(custom)
  })

  it('returns null for an unknown track', () => {
    expect(toEnrollment(enrollmentInput({ trackId: 'spanish' }), PLAN_CATALOG)).toBeNull()
  })

  it('returns null for an invalid status', () => {
    const result = toEnrollment(enrollmentInput({ status: 'archived' }), PLAN_CATALOG)
    expect(result).toBeNull()
  })

  it('otherwise maps every field', () => {
    const result = toEnrollment(
      enrollmentInput({
        status: 'paused',
        startDate: '2026-10-01',
        budgetMinutes: 40,
        newPerDay: 3,
        includeBonus: true,
        resetOn: '2026-10-05',
      }),
      PLAN_CATALOG,
    )
    expect(result).toEqual({
      trackId: 'english',
      variant: '10w',
      status: 'paused' satisfies Enrollment['status'],
      startDate: '2026-10-01',
      budgetMinutes: 40,
      newPerDay: 3,
      throttle: PLAN_CATALOG.tracks.english?.defaults.throttle,
      weeklyTemplate: PLAN_CATALOG.tracks.english?.weeklyTemplate,
      includeBonus: true,
      resetOn: '2026-10-05',
    })
  })
})

describe('the throttle-rule schema (M-11)', () => {
  it('is one schema: the manifest, toEnrollment and the track.updated payload import it', () => {
    expect(trackManifestSchema.shape.defaults.shape.throttle).toBe(throttleRulesSchema)
    expect(EVENT_PAYLOADS['track.updated'].shape.throttle.unwrap().unwrap()).toBe(
      throttleRulesSchema,
    )

    const rules = [{ dueAbove: 30, newPerDay: 2 }]
    const safeParse = vi.spyOn(throttleRulesSchema, 'safeParse')
    try {
      const result = toEnrollment(enrollmentInput({ throttle: rules }), PLAN_CATALOG)
      expect(safeParse).toHaveBeenCalledWith(rules)
      expect(result?.throttle).toEqual(rules)
    } finally {
      safeParse.mockRestore()
    }
  })
})
