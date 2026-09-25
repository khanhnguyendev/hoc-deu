/**
 * Read access to a catalog and its lazy MDX and code loaders — pure, so tests pass fixture
 * catalogs; `lib/content/catalog.ts` binds it to the generated one.
 */
import type { MDXContent } from 'mdx/types'
import type { Catalog, CatalogItem, DeckSummary } from './catalog-types'
import type { CodeBundle } from './code-tokens'
import type { TrackManifest } from './schemas/manifest'
import type { Roadmap } from './schemas/roadmap'

export type MdxLoaders = Readonly<Record<string, () => Promise<{ default: MDXContent }>>>
export type CodeLoaders = Readonly<Record<string, () => Promise<{ default: CodeBundle }>>>

export type CatalogAccess = {
  catalog: Catalog
  getTrack(id: string): TrackManifest | null
  getItem(id: string): CatalogItem | null
  /** Sorted by ID. */
  getTrackItems(trackId: string): CatalogItem[]
  getRoadmap(trackId: string, variant: string): Roadmap | null
  getDeck(id: string): DeckSummary | null
  /** A lesson ID or `<problem ID>#note`; null for an unknown key. */
  loadMdx(key: string): Promise<MDXContent | null>
  loadCode(itemId: string): Promise<CodeBundle | null>
}

/** `record[key]` for an own key only (IDs come from URLs: `toString` is not an item). */
function own<T>(record: Readonly<Record<string, T>> | undefined, key: string): T | null {
  return record !== undefined && Object.hasOwn(record, key) ? (record[key] ?? null) : null
}

const byId = (a: { id: string }, b: { id: string }): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0

/** Plain closures, no `this`: every function may be exported on its own. */
export function createCatalogAccess(
  catalog: Catalog,
  loaders: { mdx: MdxLoaders; code: CodeLoaders },
): CatalogAccess {
  const trackItems = new Map<string, CatalogItem[]>()
  for (const item of Object.values(catalog.items)) {
    const list = trackItems.get(item.trackId) ?? []
    list.push(item)
    trackItems.set(item.trackId, list)
  }
  for (const list of trackItems.values()) list.sort(byId)

  return {
    catalog,
    getTrack: (id) => catalog.tracks.find((track) => track.id === id) ?? null,
    getItem: (id) => own(catalog.items, id),
    getTrackItems: (trackId) => [...(trackItems.get(trackId) ?? [])],
    getRoadmap: (trackId, variant) => own(own(catalog.roadmaps, trackId) ?? undefined, variant),
    getDeck: (id) => own(catalog.decks, id),
    loadMdx: async (key) => {
      const load = own(loaders.mdx, key)
      return load === null ? null : (await load()).default
    },
    loadCode: async (itemId) => {
      const load = own(loaders.code, itemId)
      return load === null ? null : (await load()).default
    },
  }
}
