/**
 * The non-UI half of an item type (platform design §3.2, §7.6): schema, outcomes, `srs` flag and
 * estimates. `features/items/registry.ts` joins it with the Page and Row components (3.4a).
 */
import type { z } from 'zod'
import type { ItemType } from '../schemas/common'
import type { TrackEstimates } from '../schemas/manifest'

export type Mode = 'new' | 'recall' | 'redo' | 'review' | 'explain-aloud'
export type Outcome = 'success' | 'partial' | 'fail'

export type ItemTypeCore<T> = {
  type: ItemType
  /** Validates the authored entry at build time. */
  schema: z.ZodType<T>
  /** Result name → SRS outcome (§5.7); `{}` for completion-only types. */
  outcomes: Readonly<Record<string, Outcome>>
  srs: boolean
  /** Minutes for one item in `mode`; the manifest's `estimates` / `review` are the source (§5.4). */
  estimateMinutes(item: T, estimates: TrackEstimates, mode: Mode): number
}

/** The estimate, or an error naming the manifest field (a listed type always has one, §3.4). */
export function requireEstimate<T>(value: T | undefined, field: string): T {
  if (value === undefined) throw new Error(`The track manifest has no ${field}`)
  return value
}
