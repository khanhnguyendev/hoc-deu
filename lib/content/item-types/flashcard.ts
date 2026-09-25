/**
 * Flashcards and deck files, `decks/<slug>.yaml` (platform design §3.4, §3.5; decision 10): one
 * card shape — `front` / `back` / `hint` plus the vocabulary fields — for authored and derived cards.
 */
import { z } from 'zod'
import {
  checkProvenance,
  itemStatusSchema,
  localizedTextSchema,
  nonEmptyText,
  provenanceShape,
  whenFieldsValid,
} from '../schemas/common'
import {
  isReservedId,
  LOCAL_ID_PREFIX,
  parseDerivedId,
  parseItemId,
  prefixedItemIdSchema,
  slugSchema,
} from '../schemas/ids'
import { requireEstimate, type ItemTypeCore } from './types'

export const PARTS_OF_SPEECH = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'phrase',
  'phrasal-verb',
  'idiom',
  'abbreviation',
] as const
export const REGISTERS = ['formal', 'neutral', 'informal'] as const
/** `core` cards count toward week sizes (§3.4); `derived` only on generated cards. */
export const CARD_TIERS = ['core', 'extended', 'derived'] as const
export type CardTier = (typeof CARD_TIERS)[number]

const RESERVED_LOCAL_PREFIXES: readonly string[] = Object.values(LOCAL_ID_PREFIX)

/** Why `id` cannot be a card with this tier, or null when it can. */
function cardIdProblem(id: string, tier: CardTier): string | null {
  if (tier === 'derived') {
    return parseDerivedId(id) === null
      ? 'a derived card has a derived ID (<track>:<deck>:<source item ID>)'
      : null
  }
  if (isReservedId(id)) return 'IDs starting "user:" are reserved'
  const localId = parseItemId(id)?.localId
  if (localId === undefined) return `"${id}" is not an item ID (<track>:<local id>, [a-z0-9-])`
  const prefix = RESERVED_LOCAL_PREFIXES.find((reserved) => localId.startsWith(reserved))
  return prefix === undefined ? null : `a card's local ID must not start with "${prefix}"`
}

export const cardSchema = z
  .strictObject({
    id: z.string(),
    tier: z.enum(CARD_TIERS),
    front: nonEmptyText,
    back: nonEmptyText,
    hint: nonEmptyText.optional(),
    usage: z
      .strictObject({
        pos: z.enum(PARTS_OF_SPEECH),
        register: z.enum(REGISTERS),
        note: nonEmptyText.optional(),
      })
      .optional(),
    /** One work-context example sentence. */
    example: nonEmptyText.optional(),
    pronunciation: nonEmptyText.optional(),
    tags: z.array(slugSchema).default([]),
    status: itemStatusSchema,
    ...provenanceShape,
  })
  .superRefine((card, ctx) => {
    const problem = cardIdProblem(card.id, card.tier)
    if (problem !== null) ctx.addIssue({ code: 'custom', path: ['id'], message: problem })
    checkProvenance(card, ctx)
  }, whenFieldsValid)

export type Card = z.infer<typeof cardSchema>

/** The fields every card of a `vocabulary` deck carries (§3.5). */
const VOCABULARY_FIELDS = ['usage', 'example', 'pronunciation'] as const

export const deckFileSchema = z
  .strictObject({
    id: prefixedItemIdSchema(LOCAL_ID_PREFIX.deck),
    kind: z.enum(['vocabulary', 'recall']),
    week: z.number().int().positive(),
    topic: slugSchema,
    title: localizedTextSchema,
    lang: z
      .strictObject({ front: z.enum(['en', 'vi']), back: z.enum(['en', 'vi']) })
      .default({ front: 'en', back: 'vi' }),
    status: itemStatusSchema,
    cards: z.array(cardSchema).min(1),
  })
  .superRefine((deck, ctx) => {
    const ids = new Set<string>()
    deck.cards.forEach((card, index) => {
      if (ids.has(card.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['cards', index, 'id'],
          message: `duplicate card ${card.id}`,
        })
      }
      ids.add(card.id)
      if (card.tier === 'derived') {
        ctx.addIssue({
          code: 'custom',
          path: ['cards', index, 'tier'],
          message: 'derived cards are generated, never written in a deck file',
        })
      }
      if (deck.kind === 'vocabulary') {
        for (const field of VOCABULARY_FIELDS) {
          if (card[field] === undefined) {
            ctx.addIssue({
              code: 'custom',
              path: ['cards', index, field],
              message: `a vocabulary card needs ${field}`,
            })
          }
        }
      }
    })
  }, whenFieldsValid)

export type DeckFile = z.infer<typeof deckFileSchema>

export const flashcardType: ItemTypeCore<Card> = {
  type: 'flashcard',
  schema: cardSchema,
  outcomes: { know: 'success', unsure: 'partial', dont_know: 'fail' },
  srs: true,
  estimateMinutes(_card, { estimates }, mode) {
    const minutes = requireEstimate(estimates.flashcard, 'estimates.flashcard')
    return mode === 'new' ? minutes.new : minutes.review
  },
}
