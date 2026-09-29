/**
 * The generated catalog (platform design §3.6; decision 5), for the server. `pnpm content:build`
 * writes `.generated/` before `dev`, `build`, `typecheck`, `test` (so `verify`) and `test:e2e`; the
 * MDX and code modules load lazily, one item page at a time.
 */
import 'server-only'
import { CATALOG, CATALOG_VERSION } from '@/.generated/catalog'
import { CODE_LOADERS } from '@/.generated/code'
import { MDX_LOADERS } from '@/.generated/mdx'
import { createCatalogAccess, type CatalogAccess } from './catalog-access'
import type { Catalog } from './catalog-types'

export const catalogAccess: CatalogAccess = createCatalogAccess(CATALOG, {
  mdx: MDX_LOADERS,
  code: CODE_LOADERS,
})

export function getCatalog(): Catalog {
  return catalogAccess.catalog
}

// Plain closures (catalog-access.ts), so each works on its own.
export const { getTrack, getItem, getTrackItems, getRoadmap, getDeck, loadMdx, loadCode } =
  catalogAccess

/**
 * The deployed catalog's version (§6.4.1, Part B-M6 decision 21): `content:build` writes the first
 * 16 hex digits of the SHA-256 of the canonical catalog JSON. The bot reports it with each run.
 */
export function catalogVersion(): string {
  return CATALOG_VERSION
}
