import { describe, expect, expectTypeOf, it } from 'vitest'
import { createCatalogAccess } from './catalog-access'
import type { Catalog, CatalogItem, ContentByType } from './catalog-types'
import type { CodeBundle } from './code-tokens'
import type { AuthoredByType } from './item-types'
import type { TrackManifest } from './schemas/manifest'
import type { Roadmap } from './schemas/roadmap'

const track = (id: string) => ({ id, status: 'active' }) as TrackManifest

const prompt = (trackId: string, localId: string): CatalogItem<'prompt'> => ({
  id: `${trackId}:${localId}`,
  type: 'prompt',
  trackId,
  localId,
  topicId: null,
  week: 1,
  status: 'active',
  title: 'Ghi âm',
  source: `content/tracks/${trackId}/prompts/p.yaml`,
  content: {
    id: `${trackId}:${localId}`,
    tag: 'weekend-task',
    week: 1,
    instruction: { vi: 'Ghi âm', en: 'Record' },
    rubric: [],
    repeatable: false,
    status: 'active',
  },
})

const ROADMAP: Roadmap = {
  id: '10w',
  weeks: [{ week: 1, topics: ['standup'], core: [], bonus: [], recap: [], decks: [] }],
}

// Items deliberately out of order: getTrackItems sorts by ID.
const CATALOG: Catalog = {
  schemaVersion: 1,
  tracks: [track('dsa'), track('english')],
  roadmaps: { english: { '10w': ROADMAP }, dsa: {} },
  missingRoadmaps: [{ trackId: 'dsa', variant: '8w' }],
  decks: {
    'english:deck-w01-standup': {
      id: 'english:deck-w01-standup',
      trackId: 'english',
      kind: 'vocabulary',
      week: 1,
      topicId: 'standup',
      title: { vi: 'Họp stand-up', en: 'Stand-up meetings' },
      status: 'active',
      cardIds: [],
    },
  },
  items: {
    'english:prompt-w02': prompt('english', 'prompt-w02'),
    'dsa:prompt-mock': prompt('dsa', 'prompt-mock'),
    'english:prompt-w01': prompt('english', 'prompt-w01'),
  },
  coverage: {},
}

const BUNDLE: CodeBundle = { solutions: {}, blocks: {} }
const Body = () => null

const access = createCatalogAccess(CATALOG, {
  mdx: { 'dsa:lesson-two-pointers': async () => ({ default: Body }) },
  code: { 'dsa:lc-0001': async () => ({ default: BUNDLE }) },
})

describe('createCatalogAccess', () => {
  it('exposes the catalog', () => {
    expect(access.catalog).toBe(CATALOG)
  })

  it('getTrack finds a track by ID, or null', () => {
    expect(access.getTrack('english')?.id).toBe('english')
    expect(access.getTrack('nope')).toBeNull()
  })

  it('getItem finds an item by ID, or null (also for prototype keys)', () => {
    expect(access.getItem('dsa:prompt-mock')?.localId).toBe('prompt-mock')
    expect(access.getItem('dsa:nope')).toBeNull()
    expect(access.getItem('toString')).toBeNull()
  })

  it('getTrackItems returns one track’s items sorted by ID', () => {
    expect(access.getTrackItems('english').map((item) => item.id)).toEqual([
      'english:prompt-w01',
      'english:prompt-w02',
    ])
    expect(access.getTrackItems('nope')).toEqual([])
  })

  it('getRoadmap returns an existing roadmap, and null for a missing file or track', () => {
    expect(access.getRoadmap('english', '10w')).toBe(ROADMAP)
    expect(access.getRoadmap('dsa', '8w')).toBeNull()
    expect(access.getRoadmap('nope', '10w')).toBeNull()
    expect(access.getRoadmap('english', 'constructor')).toBeNull()
  })

  it('getDeck finds a deck by ID, or null', () => {
    expect(access.getDeck('english:deck-w01-standup')?.kind).toBe('vocabulary')
    expect(access.getDeck('english:deck-w02')).toBeNull()
  })

  it('loadMdx returns the loader’s default export, and null for an unknown key', async () => {
    await expect(access.loadMdx('dsa:lesson-two-pointers')).resolves.toBe(Body)
    await expect(access.loadMdx('dsa:lc-0001#note')).resolves.toBeNull()
    await expect(access.loadMdx('__proto__')).resolves.toBeNull()
  })

  it('loadCode returns the bundle, and null for an unknown item', async () => {
    await expect(access.loadCode('dsa:lc-0001')).resolves.toBe(BUNDLE)
    await expect(access.loadCode('dsa:lc-0002')).resolves.toBeNull()
  })

  it('its functions work unbound (catalog.ts exports them one by one)', () => {
    const { getItem } = access
    expect(getItem('dsa:prompt-mock')?.id).toBe('dsa:prompt-mock')
  })
})

describe('catalog types', () => {
  it('every item content extends the authored shape of its type', () => {
    expectTypeOf<ContentByType['problem']>().toExtend<AuthoredByType['problem']>()
    expectTypeOf<ContentByType['lesson']>().toExtend<AuthoredByType['lesson']>()
    expectTypeOf<ContentByType['flashcard']>().toExtend<AuthoredByType['flashcard']>()
    expectTypeOf<ContentByType['exercise']>().toExtend<AuthoredByType['exercise']>()
    expectTypeOf<ContentByType['prompt']>().toExtend<AuthoredByType['prompt']>()
  })

  it('CatalogItem<K> ties type to content', () => {
    expectTypeOf<CatalogItem<'lesson'>['content']>().toEqualTypeOf<ContentByType['lesson']>()
    expectTypeOf<CatalogItem['type']>().toEqualTypeOf<keyof ContentByType>()
  })
})
