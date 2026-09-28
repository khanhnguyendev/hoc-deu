/**
 * A learner's custom items (platform design §3.3, §5.12, §6.4.4; Part B-M6 decisions 17, 17a, 39):
 * `user_items` rows as catalog items and plan items, and the per-user **catalog overlay**
 * (`withUserItems`) that adds them to the plan catalog, so the engine, the item page, `/today`'s
 * rows, `/review` and the check-in actions see them like any item. Pure over the catalog types —
 * no Supabase, no clock; `lib/plans/reads.ts` reads the rows and `lib/bot/custom-items.ts`
 * validates the bot's payloads here.
 *
 * A payload is validated by **the repository's item schema** with the server-owned fields filled
 * in (decision 17a): flashcard `id` (a synthetic repository-form ID, for validation only), `tier:
 * 'extended'`, `status`; exercise `id`, `topic` (= the topic), `week` (the track's roadmap week at
 * creation), `status`; prompt `id`, `tag: 'custom'`, `repeatable: true`, `status`; provenance
 * (`origin`, `createdByRun`) never. A payload that sets any of them is invalid. What is stored is
 * the schema's output without those fields — the exercise's `week` kept — so defaults are stored
 * once and a row reads back exactly as it was validated.
 */
import { CUSTOM_ITEM_PREFIX, type PlanCatalog, type PlanItem } from '@/lib/domain/catalog'
import type { CatalogItem, FlashcardContent } from './catalog-types'
import { cardSchema } from './item-types/flashcard'
import { exerciseSchema } from './item-types/exercise'
import { promptSchema } from './item-types/prompt'
import { planItemOf } from './plan-catalog'
import type { TrackManifest } from './schemas/manifest'
import { LOCAL_ID_PREFIX } from './schemas/ids'

export type CustomItemType = 'flashcard' | 'exercise' | 'prompt'

export type UserItemRow = {
  itemId: string
  itemType: CustomItemType
  trackId: string
  topicId: string
  payload: unknown
  status: 'active' | 'hidden' | 'retired'
  createdOn: string
}

/** A custom item as the item registry renders it. */
export type UserCatalogItem = CatalogItem<CustomItemType>

/** The tag every custom prompt carries (decision 17a): no template block picks it. */
export const CUSTOM_PROMPT_TAG = 'custom'

/** `user_items.payload`'s bound (`octet_length(payload::text) <= 2048`). */
export const MAX_PAYLOAD_BYTES = 2048

/** `user:<bot_ref>:<slug>` (§6.3: the profile's stable opaque key, never the user id). */
export function customItemId(botRef: string, slug: string): string {
  return `${CUSTOM_ITEM_PREFIX}${botRef}:${slug}`
}

const SERVER_OWNED: Readonly<Record<CustomItemType, readonly string[]>> = {
  flashcard: ['id', 'tier', 'status'],
  exercise: ['id', 'topic', 'week', 'status'],
  prompt: ['id', 'tag', 'repeatable', 'status'],
}
const PROVENANCE = ['origin', 'createdByRun'] as const

/** The fields removed before storing; the exercise keeps its `week` (decision 17a). */
const STRIPPED: Readonly<Record<CustomItemType, readonly string[]>> = {
  flashcard: ['id', 'tier', 'status'],
  exercise: ['id', 'topic', 'status'],
  prompt: ['id', 'tag', 'repeatable', 'status'],
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** The synthetic repository-form ID a payload is validated under (`<track>:<prefix>custom`). */
function syntheticId(type: CustomItemType, trackId: string): string {
  switch (type) {
    case 'flashcard':
      return `${trackId}:custom`
    case 'exercise':
      return `${trackId}:${LOCAL_ID_PREFIX.exercise}custom`
    case 'prompt':
      return `${trackId}:${LOCAL_ID_PREFIX.prompt}custom`
  }
}

type Ctx = { trackId: string; topicId: string; week: number }

/** `payload` with the server-owned fields of `type` (decision 17a). */
function withServerFields(
  type: CustomItemType,
  payload: Record<string, unknown>,
  ctx: Ctx,
): Record<string, unknown> {
  const id = syntheticId(type, ctx.trackId)
  switch (type) {
    case 'flashcard':
      return { ...payload, id, tier: 'extended', status: 'active' }
    case 'exercise':
      return { ...payload, id, topic: ctx.topicId, week: ctx.week, status: 'active' }
    case 'prompt':
      return { ...payload, id, tag: CUSTOM_PROMPT_TAG, repeatable: true, status: 'active' }
  }
}

function schemaOf(type: CustomItemType) {
  switch (type) {
    case 'flashcard':
      return cardSchema
    case 'exercise':
      return exerciseSchema
    case 'prompt':
      return promptSchema
  }
}

function without(
  record: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !keys.includes(key)))
}

/**
 * Decision 17a: the payload validated by the repository schema with the server-owned fields; on
 * success the payload to store. Issues are `"<path>: <message>"`, the path inside the payload.
 */
export function parseCustomPayload(
  type: CustomItemType,
  payload: unknown,
  ctx: Ctx,
): { ok: true; payload: Record<string, unknown> } | { ok: false; issues: string[] } {
  if (!isRecord(payload)) return { ok: false, issues: ['payload: must be an object'] }
  const owned = [...SERVER_OWNED[type], ...PROVENANCE].filter((key) => Object.hasOwn(payload, key))
  if (owned.length > 0) {
    return { ok: false, issues: owned.map((key) => `${key}: set by the server, never sent`) }
  }
  const parsed = schemaOf(type).safeParse(withServerFields(type, payload, ctx))
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.map(String).join('.') || 'payload'}: ${issue.message}`,
      ),
    }
  }
  return { ok: true, payload: without(parsed.data as Record<string, unknown>, STRIPPED[type]) }
}

// C0 and C1 control characters (a newline and a tab included): plain text is one run of text.
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/
const URL_LIKE = /https?:\/\/|\bwww\./i

/**
 * §6.4.4 "plain text only (no MDX, HTML or URLs)": no `<` or `>`, nothing that looks like a URL
 * (`http://`, `https://`, `www.`), no control characters. Vietnamese with diacritics is text.
 */
export function isPlainText(value: string): boolean {
  return (
    !value.includes('<') && !value.includes('>') && !URL_LIKE.test(value) && !CONTROL.test(value)
  )
}

/** Every string inside `value` (object values and array elements, at any depth), with its path. */
export function stringsOf(value: unknown, path = ''): { path: string; value: string }[] {
  if (typeof value === 'string') return [{ path, value }]
  const join = (key: string | number) => (path === '' ? String(key) : `${path}.${key}`)
  if (Array.isArray(value)) return value.flatMap((entry, index) => stringsOf(entry, join(index)))
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, entry]) => [
      ...(isPlainText(key) ? [] : [{ path: join(key), value: key }]),
      ...stringsOf(entry, join(key)),
    ])
  }
  return []
}

/**
 * The bytes of `value` as Postgres prints a `jsonb` (`payload::text`, what the table's 2 KB check
 * measures): JSON with a space after every `:` and every `,`.
 */
export function jsonbTextBytes(value: unknown): number {
  let extra = 0
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      extra += Math.max(node.length - 1, 0)
      node.forEach(walk)
    } else if (isRecord(node)) {
      const entries = Object.values(node).filter((entry) => entry !== undefined)
      extra += entries.length + Math.max(entries.length - 1, 0)
      entries.forEach(walk)
    }
  }
  walk(value)
  return new TextEncoder().encode(JSON.stringify(value)).byteLength + extra
}

/** A card's sides: English front, Vietnamese back — the deck files' default (`deckFileSchema`). */
const CARD_LANG: FlashcardContent['lang'] = { front: 'en', back: 'vi', hint: 'vi' }

/** Hidden and retired custom items read as `retired` (decision 17). */
const statusOf = (row: UserItemRow): 'active' | 'retired' =>
  row.status === 'active' ? 'active' : 'retired'

/**
 * The stored payload as the registry's item (the item page, `/today`'s rows, `/review`'s cards):
 * the payload re-validated with its server-owned fields, the item's own ID, `localId` = the whole
 * ID (so `itemHref` builds decision 39's URL). Throws when the stored payload no longer parses
 * (`withUserItems` and `userCatalogItems` leave such a row out).
 */
export function toCatalogItem(row: UserItemRow): UserCatalogItem {
  const week = isRecord(row.payload) && typeof row.payload.week === 'number' ? row.payload.week : 1
  const payload = isRecord(row.payload) ? without(row.payload, SERVER_OWNED[row.itemType]) : {}
  const full = withServerFields(row.itemType, payload, {
    trackId: row.trackId,
    topicId: row.topicId,
    week,
  })
  const status = statusOf(row)
  const base = {
    id: row.itemId,
    trackId: row.trackId,
    localId: row.itemId,
    topicId: row.topicId,
    status,
    source: 'user_items',
  }
  switch (row.itemType) {
    case 'flashcard': {
      const card = cardSchema.parse(full)
      return {
        ...base,
        type: 'flashcard',
        week: null,
        title: card.front,
        content: {
          ...card,
          id: row.itemId,
          status,
          deckId: '',
          lang: CARD_LANG,
          derivedFrom: null,
        },
      }
    }
    case 'exercise': {
      const exercise = exerciseSchema.parse(full)
      return {
        ...base,
        type: 'exercise',
        week: exercise.week,
        title: exercise.instruction.vi,
        content: { ...exercise, id: row.itemId, status },
      }
    }
    case 'prompt': {
      const prompt = promptSchema.parse(full)
      return {
        ...base,
        type: 'prompt',
        week: null,
        title: prompt.instruction.vi,
        content: { ...prompt, id: row.itemId, status },
      }
    }
  }
}

/**
 * The engine's view (§5.12): minutes and SRS parameters from the same helpers as the repository's
 * items (`planItemOf` — estimates from the manifest, `srs.byType` for cards); hidden and retired
 * rows read as `retired`. No week and no deck: a custom item is in no roadmap and no deck, so the
 * baseline's new queue and week pickers never take it (§5.12: override blocks, AI plans and the
 * "Mục riêng" tab schedule it).
 */
export function toPlanItem(row: UserItemRow, manifest: TrackManifest): PlanItem {
  return { ...planItemOf(toCatalogItem(row), manifest), week: null, deckId: null }
}

/** The rows that still read as items, by ID (a row whose payload no longer parses is left out). */
function readable(rows: readonly UserItemRow[]): UserItemRow[] {
  return rows.filter((row) => {
    try {
      toCatalogItem(row)
      return true
    } catch {
      return false
    }
  })
}

/** The registry items of `rows`, by ID; unreadable rows are left out. */
export function userCatalogItems(
  rows: readonly UserItemRow[],
): Readonly<Record<string, UserCatalogItem>> {
  return Object.fromEntries(readable(rows).map((row) => [row.itemId, toCatalogItem(row)]))
}

/** A plan catalog with a learner's custom items (`withUserItems`): their registry items too. */
export type OverlayCatalog = PlanCatalog & {
  readonly userItems: Readonly<Record<string, UserCatalogItem>>
}

/**
 * The per-user catalog overlay (decision 17): `catalog` plus the rows of a track the catalog and
 * `manifests` know, as plan items (`toPlanItem`) — and as registry items under `userItems`, which
 * `userItemOf` reads. A row that cannot be read is left out. Without a row it is `catalog`
 * itself; nothing is mutated.
 */
export function withUserItems(
  catalog: PlanCatalog,
  rows: readonly UserItemRow[],
  manifests: readonly TrackManifest[],
): PlanCatalog {
  if (rows.length === 0) return catalog
  const manifestOf = new Map(manifests.map((manifest) => [manifest.id, manifest]))
  const items: Record<string, PlanItem> = { ...catalog.items }
  const registry: Record<string, UserCatalogItem> = {}
  for (const row of rows) {
    const manifest = manifestOf.get(row.trackId)
    if (manifest === undefined || !Object.hasOwn(catalog.tracks, row.trackId)) continue
    if (!row.itemId.startsWith(CUSTOM_ITEM_PREFIX)) continue
    try {
      const planItem = toPlanItem(row, manifest)
      registry[row.itemId] = toCatalogItem(row)
      items[row.itemId] = planItem
    } catch {
      // A payload that no longer parses, or a manifest without the type's estimate: left out.
    }
  }
  const overlay: OverlayCatalog = { ...catalog, items, userItems: registry }
  return overlay
}

/** The custom item `itemId` of an overlay catalog (`withUserItems`), or null. */
export function userItemOf(catalog: PlanCatalog, itemId: string): UserCatalogItem | null {
  const registry = (catalog as Partial<OverlayCatalog>).userItems
  return registry !== undefined && Object.hasOwn(registry, itemId)
    ? (registry[itemId] ?? null)
    : null
}
