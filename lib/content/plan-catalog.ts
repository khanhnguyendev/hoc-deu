/**
 * Content → domain adapter (platform design §3.2–§3.5, §5.4, §5.7; decision 4): builds the plan
 * engine's `PlanCatalog` from the generated content `Catalog`, and resolves a `user_tracks` row
 * into an `Enrollment`. Not `server-only` — pure, so `tools/sim` and M5's loaders can import it.
 * `lib/domain` never imports `lib/content` (decision 4); this file is the one place that reads
 * both.
 */
import {
  ITEM_MODES,
  type PlanCatalog,
  type PlanDeck,
  type PlanItem,
  type PlanRoadmap,
  type PlanTrack,
  throttleRulesSchema,
} from '@/lib/domain/catalog'
import { type Enrollment, MAX_BLOCK_MINUTES } from '@/lib/domain/plan/types'
import type { Catalog, CatalogItem, DeckSummary } from './catalog-types'
import { ITEM_TYPE_CORES, type Mode } from './item-types'
import {
  type TemplateBlock,
  type TrackEstimates,
  type TrackManifest,
  weeklyTemplateSchema,
} from './schemas/manifest'
import type { Roadmap } from './schemas/roadmap'
import type { ItemType } from './schemas/common'

// -------------------------------------------------------------------------------------------
// Items
// -------------------------------------------------------------------------------------------

/** Minutes for `item` in every mode (§5.4): each item type's core knows its own estimate rule. */
function estimateMinutesFor(item: CatalogItem, estimates: TrackEstimates, mode: Mode): number {
  switch (item.type) {
    case 'problem':
      return ITEM_TYPE_CORES.problem.estimateMinutes(item.content, estimates, mode)
    case 'lesson':
      return ITEM_TYPE_CORES.lesson.estimateMinutes(item.content, estimates, mode)
    case 'flashcard':
      return ITEM_TYPE_CORES.flashcard.estimateMinutes(item.content, estimates, mode)
    case 'exercise':
      return ITEM_TYPE_CORES.exercise.estimateMinutes(item.content, estimates, mode)
    case 'prompt':
      return ITEM_TYPE_CORES.prompt.estimateMinutes(item.content, estimates, mode)
  }
}

function minutesByMode(item: CatalogItem, estimates: TrackEstimates): PlanItem['minutes'] {
  const entries = ITEM_MODES.map(
    (mode) => [mode, estimateMinutesFor(item, estimates, mode)] as const,
  )
  return Object.fromEntries(entries) as PlanItem['minutes']
}

/** `srs` = the track's params, with the item type's `srs.byType` override shallow-merged in. */
function resolveSrs(srs: TrackManifest['srs'], type: ItemType): PlanItem['srs'] {
  const { byType, ...base } = srs
  // Only called for problem / flashcard (the types with `srs: true`) — the only `byType` keys.
  const override = byType?.[type as 'problem' | 'flashcard']
  return { ...base, ...override }
}

type ItemTypeExtras = Pick<
  PlanItem,
  | 'reviewModes'
  | 'difficulty'
  | 'tier'
  | 'deckId'
  | 'derivedFrom'
  | 'hasExample'
  | 'about'
  | 'deepDiveId'
  | 'tag'
  | 'repeatable'
>

const NEUTRAL_EXTRAS: ItemTypeExtras = {
  reviewModes: false,
  difficulty: null,
  tier: null,
  deckId: null,
  derivedFrom: null,
  hasExample: false,
  about: null,
  deepDiveId: null,
  tag: null,
  repeatable: false,
}

/** The fields that only one item type carries (§3.2–§3.5). */
function itemTypeExtras(
  item: CatalogItem,
  deepDiveOf: ReadonlyMap<string, string>,
): ItemTypeExtras {
  switch (item.type) {
    case 'problem':
      return {
        ...NEUTRAL_EXTRAS,
        reviewModes: true,
        difficulty: item.content.difficulty,
        deepDiveId: deepDiveOf.get(item.id) ?? null,
      }
    case 'flashcard':
      return {
        ...NEUTRAL_EXTRAS,
        tier: item.content.tier,
        deckId: item.content.deckId,
        derivedFrom: item.content.derivedFrom,
        hasExample: item.content.example !== undefined,
      }
    case 'lesson':
      return { ...NEUTRAL_EXTRAS, about: item.content.about ?? null }
    case 'prompt':
      return { ...NEUTRAL_EXTRAS, tag: item.content.tag, repeatable: item.content.repeatable }
    case 'exercise':
      return NEUTRAL_EXTRAS
  }
}

/**
 * Problem ID → the ID of the lesson whose `about` is that problem, whatever the lesson's status
 * and whether or not the problem has a note (§3.5 reverse lookup) — unlike `note.deepDiveId`,
 * which `content:build` only fills for a noted problem with an active deep-dive lesson. At most
 * one deep-dive per problem is enforced at build time; iterating in ID order makes a duplicate
 * (which should never reach here) deterministic rather than order-dependent.
 */
function deepDiveIndex(items: Readonly<Record<string, CatalogItem>>): ReadonlyMap<string, string> {
  const index = new Map<string, string>()
  for (const id of Object.keys(items).sort()) {
    const item = items[id]
    if (item === undefined || item.type !== 'lesson') continue
    const about = item.content.about
    if (about !== undefined && !index.has(about)) index.set(about, item.id)
  }
  return index
}

function toPlanItem(
  item: CatalogItem,
  manifest: TrackManifest,
  deepDiveOf: ReadonlyMap<string, string>,
): PlanItem {
  const core = ITEM_TYPE_CORES[item.type]
  const estimates: TrackEstimates = { estimates: manifest.estimates, review: manifest.review }
  return {
    id: item.id,
    trackId: item.trackId,
    itemType: item.type,
    topicId: item.topicId,
    week: item.week,
    status: item.status,
    srs: core.srs ? resolveSrs(manifest.srs, item.type) : null,
    minutes: minutesByMode(item, estimates),
    ...itemTypeExtras(item, deepDiveOf),
  }
}

// -------------------------------------------------------------------------------------------
// Tracks, roadmaps and decks
// -------------------------------------------------------------------------------------------

function toPlanRoadmap(roadmap: Roadmap): PlanRoadmap {
  return { id: roadmap.id, weeks: roadmap.weeks }
}

function toPlanTrack(
  manifest: TrackManifest,
  roadmaps: Readonly<Record<string, Roadmap>>,
): PlanTrack {
  return {
    id: manifest.id,
    status: manifest.status,
    weeklyTemplate: manifest.weeklyTemplate,
    defaults: manifest.defaults,
    roadmaps: Object.fromEntries(
      Object.entries(roadmaps).map(([variant, roadmap]) => [variant, toPlanRoadmap(roadmap)]),
    ),
  }
}

/** Authored decks only (decision 4); a derived deck's cards are listed as items, not the deck. */
function toPlanDecks(
  decks: Readonly<Record<string, DeckSummary>>,
): Readonly<Record<string, PlanDeck>> {
  const result: Record<string, PlanDeck> = {}
  for (const deck of Object.values(decks)) {
    if (deck.kind === 'derived') continue
    result[deck.id] = {
      id: deck.id,
      trackId: deck.trackId,
      status: deck.status,
      cardIds: deck.cardIds,
    }
  }
  return result
}

/**
 * The engine's view of `catalog` (decision 4): every item, drafts and retired included (the
 * engine filters by status), authored decks only.
 */
export function toPlanCatalog(catalog: Catalog): PlanCatalog {
  const manifestOf = new Map(catalog.tracks.map((track) => [track.id, track]))
  const deepDiveOf = deepDiveIndex(catalog.items)

  const items: Record<string, PlanItem> = {}
  for (const item of Object.values(catalog.items)) {
    const manifest = manifestOf.get(item.trackId)
    if (manifest === undefined) {
      throw new Error(`toPlanCatalog: item ${item.id} has no track manifest for "${item.trackId}"`)
    }
    items[item.id] = toPlanItem(item, manifest, deepDiveOf)
  }

  const tracks: Record<string, PlanTrack> = {}
  for (const manifest of catalog.tracks) {
    tracks[manifest.id] = toPlanTrack(manifest, catalog.roadmaps[manifest.id] ?? {})
  }

  return { tracks, items, decks: toPlanDecks(catalog.decks) }
}

// -------------------------------------------------------------------------------------------
// Enrollment (a `user_tracks` row, M5's loader)
// -------------------------------------------------------------------------------------------

/** A `user_tracks` row as M5's loader reads it (camelCase; JSON columns unvalidated). */
export type EnrollmentInput = {
  readonly trackId: string
  readonly roadmapVariant: string
  readonly status: string
  readonly startDate: string
  readonly budgetMinutes: number
  readonly newPerDay: number | null
  readonly throttle: unknown
  readonly weeklyTemplate: unknown
  readonly includeBonus: boolean
  readonly resetOn: string | null
}

const ENROLLMENT_STATUSES = ['active', 'paused', 'removed'] as const

function isEnrollmentStatus(status: string): status is Enrollment['status'] {
  return (ENROLLMENT_STATUSES as readonly string[]).includes(status)
}

/** A practice block's minutes or a review block's cap that a stored plan block can hold (M-4). */
const fitsAPlanBlock = (block: TemplateBlock): boolean =>
  (block.kind !== 'practice' || block.minutes <= MAX_BLOCK_MINUTES) &&
  (block.kind !== 'review' || (block.maxMinutes ?? 0) <= MAX_BLOCK_MINUTES)

/** A learner's stored template: the manifest's rules, and every block storable (M4 final review
 *  M-4 — a crafted `track.updated` must not produce a plan `day_plans` cannot read back). */
const enrollmentTemplateSchema = weeklyTemplateSchema.refine((template) =>
  Object.values(template).every((blocks) => (blocks ?? []).every(fitsAPlanBlock)),
)

/**
 * Resolves every null / invalid setting to the track default (M2 ruling R14, the reader
 * validates a learner-writable JSON column): `newPerDay` null → `defaults.newPerDay`; `throttle`
 * / `weeklyTemplate` invalid or null → the track's (a template block of more than
 * `MAX_BLOCK_MINUTES` is invalid, M-4); unknown track or status → null (the row is ignored).
 */
export function toEnrollment(input: EnrollmentInput, catalog: PlanCatalog): Enrollment | null {
  const track = catalog.tracks[input.trackId]
  if (track === undefined || !isEnrollmentStatus(input.status)) return null

  const throttle = throttleRulesSchema.safeParse(input.throttle)
  const weeklyTemplate = enrollmentTemplateSchema.safeParse(input.weeklyTemplate)

  return {
    trackId: input.trackId,
    variant: input.roadmapVariant,
    status: input.status,
    startDate: input.startDate,
    budgetMinutes: input.budgetMinutes,
    newPerDay: input.newPerDay ?? track.defaults.newPerDay,
    throttle: throttle.success ? throttle.data : track.defaults.throttle,
    weeklyTemplate: weeklyTemplate.success ? weeklyTemplate.data : track.weeklyTemplate,
    includeBonus: input.includeBonus,
    resetOn: input.resetOn,
  }
}
