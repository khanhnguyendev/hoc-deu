/**
 * ID rules (platform design §3.3, decision 9): the patterns and parsers. `content:build` (3.2b)
 * adds the file checks — a folder's track is its IDs' track, a file's name is its ID.
 *
 * IDs are ASCII (`[a-z0-9-]`, [RF-3]) and append-only: events reference them forever.
 */
import { z } from 'zod'
import { ROADMAP_VARIANT_PATTERN } from '@/lib/domain/settings'

/** Reserved for per-user custom items (§5.12): no track is `user`, no content ID starts `user:`. */
export const RESERVED_TRACK_ID = 'user'
const RESERVED_PREFIX = `${RESERVED_TRACK_ID}:`

/** The database's rule for `user_tracks.track_id`. */
export const TRACK_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/
export const LOCAL_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/
/** Topics, roadmap variants, lesson formats and tags; the database's `roadmap_variant` rule. */
export const SLUG_PATTERN: RegExp = ROADMAP_VARIANT_PATTERN

/** The local-ID prefix of each prefixed item kind; a card's local ID starts with none of them. */
export const LOCAL_ID_PREFIX = {
  problem: 'lc-',
  lesson: 'lesson-',
  deck: 'deck-',
  exercise: 'ex-',
  prompt: 'prompt-',
} as const

/** A problem folder's LeetCode slug. */
const LEETCODE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_LEETCODE_SLUG = 80
/** `lc-<number, at least 4 digits>-<slug>`; the slug is checked separately. */
const PROBLEM_FOLDER = /^lc-(\d{4,5})-(.+)$/

export type ParsedItemId = { trackId: string; localId: string }
export type ParsedDerivedId = { trackId: string; deckId: string; sourceId: string }

export const isReservedId = (id: string): boolean => id.startsWith(RESERVED_PREFIX)

const isTrackId = (id: string): boolean => TRACK_ID_PATTERN.test(id) && id !== RESERVED_TRACK_ID

/** `<trackId>:<localId>` with exactly one `:`; `null` when malformed or reserved. */
export function parseItemId(id: string): ParsedItemId | null {
  const parts = id.split(':')
  if (parts.length !== 2) return null
  const [trackId = '', localId = ''] = parts
  if (!isTrackId(trackId) || !LOCAL_ID_PATTERN.test(localId)) return null
  return { trackId, localId }
}

/** `<track>:<derived deck id>:<source item ID>`, e.g. `english:explaining-code:dsa:lc-0001`. */
export function parseDerivedId(id: string): ParsedDerivedId | null {
  const parts = id.split(':')
  if (parts.length !== 4) return null
  const [trackId = '', deckId = '', ...source] = parts
  const sourceId = source.join(':')
  if (!isTrackId(trackId) || !LOCAL_ID_PATTERN.test(deckId)) return null
  if (parseItemId(sourceId) === null) return null
  return { trackId, deckId, sourceId }
}

export const derivedCardId = (trackId: string, deckId: string, sourceId: string): string =>
  `${trackId}:${deckId}:${sourceId}`

/** 1 → `lc-0001`, 1143 → `lc-1143`, 10000 → `lc-10000`. */
export const problemLocalId = (leetcode: number): string =>
  `${LOCAL_ID_PREFIX.problem}${String(leetcode).padStart(4, '0')}`

/**
 * A problem folder name, `lc-<number>-<LeetCode slug>` (`lc-0001-two-sum`): the number zero-padded
 * to exactly four digits (five from 10000), the slug `[a-z0-9]` words joined by single hyphens and at
 * most 80 characters. `null` otherwise.
 */
export function parseProblemFolder(name: string): { leetcode: number; slug: string } | null {
  const match = PROBLEM_FOLDER.exec(name)
  if (match === null) return null
  const [, digits = '', slug = ''] = match
  const leetcode = Number(digits)
  if (leetcode < 1 || problemLocalId(leetcode) !== `${LOCAL_ID_PREFIX.problem}${digits}`) {
    return null
  }
  if (!LEETCODE_SLUG.test(slug) || slug.length > MAX_LEETCODE_SLUG) return null
  return { leetcode, slug }
}

export const trackIdSchema = z
  .string()
  .regex(TRACK_ID_PATTERN, 'a track ID is [a-z][a-z0-9-], at most 32 characters')
  .refine((id) => id !== RESERVED_TRACK_ID, `the track ID "${RESERVED_TRACK_ID}" is reserved`)

export const localIdSchema = z
  .string()
  .regex(LOCAL_ID_PATTERN, 'a local ID is [a-z0-9][a-z0-9-], at most 64 characters')

export const itemIdSchema = z.string().superRefine((id, ctx) => {
  if (isReservedId(id)) {
    ctx.addIssue({ code: 'custom', message: `IDs starting "${RESERVED_PREFIX}" are reserved` })
  } else if (parseItemId(id) === null) {
    ctx.addIssue({
      code: 'custom',
      message: `"${id}" is not an item ID (<track>:<local id>, [a-z0-9-])`,
    })
  }
})

export const slugSchema = z
  .string()
  .regex(SLUG_PATTERN, 'a slug is [a-z0-9][a-z0-9-], at most 32 characters')

/**
 * An item ID whose local part starts with `prefix` (`dsa:lesson-arrays-hashing`,
 * `english:ex-w01-fill-1`).
 */
export const prefixedItemIdSchema = (prefix: string) =>
  itemIdSchema.refine((id) => parseItemId(id)?.localId.startsWith(prefix) ?? true, {
    message: `the local ID must start with "${prefix}"`,
  })
