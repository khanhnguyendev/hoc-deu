import { z } from 'zod'
import { budgetMinutesSchema } from '@/lib/domain/settings'
import {
  CODE_LANGUAGES,
  ITEM_STATUSES,
  ITEM_TYPES,
  localizedTextSchema,
  nonEmptyText,
  whenFieldsValid,
  type ItemType,
} from './common'
import { localIdSchema, slugSchema, trackIdSchema } from './ids'

/** DESIGN_SYSTEM track accent tokens (`track-1`..`track-8`). */
export const TRACK_ACCENTS = [
  'track-1',
  'track-2',
  'track-3',
  'track-4',
  'track-5',
  'track-6',
  'track-7',
  'track-8',
] as const

const positiveInt = z.number().int().positive()
const nonNegativeInt = z.number().int().min(0)
const positiveNumber = z.number().positive()

/** Every value appears once. */
const unique = (values: readonly unknown[]): boolean => new Set(values).size === values.length
const uniqueList = <T extends z.ZodType>(item: T, what: string) =>
  z.array(item).refine(unique, `${what} must be unique`)

// ---------------------------------------------------------------------------------------------
// Weekly template (§3.4, §5.4)
// ---------------------------------------------------------------------------------------------

/** The template's day keys, in display order. */
export const WEEKDAY_KEYS = ['mon-fri', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

/** Any block may start from a roadmap week of the user (§3.4 `fromWeek`). */
const fromWeek = { fromWeek: positiveInt.optional() }

const practiceBlockSchema = z
  .strictObject({
    kind: z.literal('practice'),
    minutes: positiveInt,
    tag: slugSchema.optional(),
    itemType: z.enum(ITEM_TYPES).optional(),
    ...fromWeek,
  })
  .refine((block) => (block.tag === undefined) !== (block.itemType === undefined), {
    message: 'a practice block has exactly one of tag or itemType',
  })

/**
 * A weekly-template block (platform design §3.4, §5.4), strict per `kind`: `review` may cap its
 * minutes, `recap` needs a `count`, `practice` a fixed length and exactly one of `tag` / `itemType`.
 */
export const templateBlockSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('review'), maxMinutes: positiveInt.optional(), ...fromWeek }),
  z.strictObject({ kind: z.literal('new'), ...fromWeek }),
  z.strictObject({ kind: z.literal('recap'), count: positiveInt, ...fromWeek }),
  practiceBlockSchema,
])
export type TemplateBlock = z.infer<typeof templateBlockSchema>

/**
 * Zod 4's `z.record` with an enum key type requires every key to be present; `z.partialRecord`
 * relaxes that (a manifest lists only the days it needs) while still rejecting a key outside the
 * enum (an unknown weekday).
 */
export const weeklyTemplateSchema = z.partialRecord(
  z.enum(WEEKDAY_KEYS),
  z.array(templateBlockSchema).min(1),
  {
    error: (issue) => {
      // At run time an enum-keyed partial record reports a stray key as `unrecognized_keys`,
      // which its issue type does not list.
      const { code, keys } = issue as { code: string; keys?: readonly string[] }
      return code === 'unrecognized_keys'
        ? `unknown weekday ${(keys ?? []).join(', ')} (expected ${WEEKDAY_KEYS.join(', ')})`
        : undefined
    },
  },
)

// ---------------------------------------------------------------------------------------------
// Spaced repetition, review and estimates (§5.4, §5.5, §5.7)
// ---------------------------------------------------------------------------------------------

const intervalsSchema = z
  .array(positiveInt)
  .min(1)
  .refine(
    (days) => days.every((day, index) => index === 0 || day > (days[index - 1] ?? 0)),
    'intervals must increase strictly',
  )

export const srsParamsSchema = z.strictObject({
  intervals: intervalsSchema,
  relearnDays: positiveInt,
  masteredAfter: positiveInt,
})

/** The item types with spaced repetition (`srs: true` in their cores). */
const SRS_ITEM_TYPES = ['problem', 'flashcard'] as const

/** `srs` with optional per-item-type overrides (§5.7): DSA cards recall faster than problems. */
export const srsSchema = srsParamsSchema.extend({
  byType: z
    .partialRecord(
      // A string piped into the enum checks each key on its own, so an issue names the key.
      z.string().pipe(z.enum(SRS_ITEM_TYPES)),
      srsParamsSchema.partial(),
      {
        error: (issue) =>
          issue.code === 'invalid_key'
            ? `not an item type with spaced repetition (${SRS_ITEM_TYPES.join(', ')})`
            : undefined,
      },
    )
    .optional(),
})

/** Problem review modes (§5.5): quick recall minutes, and redo as a share of the new estimate. */
export const reviewSchema = z.strictObject({
  recallMinutes: positiveNumber,
  redoFactor: positiveNumber.max(1),
})

/** Minutes per item type (§5.4); every listed item type has one. */
export const estimatesSchema = z.strictObject({
  lesson: positiveNumber.optional(),
  problem: z
    .strictObject({
      new: z.strictObject({ E: positiveNumber, M: positiveNumber, H: positiveNumber }),
    })
    .optional(),
  prompt: positiveNumber.optional(),
  flashcard: z.strictObject({ new: positiveNumber, review: positiveNumber }).optional(),
  exercise: positiveNumber.optional(),
})

// ---------------------------------------------------------------------------------------------
// Topics and lesson formats (§3.4, §3.6)
// ---------------------------------------------------------------------------------------------

/** `requires` = prerequisite topics; `signals` = how to recognise the pattern. */
export const topicSchema = z.strictObject({
  id: slugSchema,
  title: localizedTextSchema,
  signals: z.array(nonEmptyText).default([]),
  requires: z.array(slugSchema).default([]),
})

/** The frontmatter references a lesson format may require (§3.3). */
export const LESSON_REFS = ['anchor', 'practice', 'about'] as const
/** The cross-checks a lesson format may ask `content:build` for (§3.6). */
export const LESSON_RULES = [
  'anchor!=practice',
  'practice!=about',
  'same-topic',
  'one-per-topic',
  'max-1-per-about',
] as const

/** A lesson format: its `<Section kind>` order, required references and rules. */
export const lessonFormatSchema = z.strictObject({
  sections: uniqueList(
    z.string().regex(/^[a-z][a-z0-9-]*$/, 'a section kind is kebab-case'),
    'sections',
  ).min(1),
  requires: z.array(z.enum(LESSON_REFS)).default([]),
  rules: z.array(z.enum(LESSON_RULES)).default([]),
})

// ---------------------------------------------------------------------------------------------
// Derived decks (§3.4 English "Explaining code")
// ---------------------------------------------------------------------------------------------

/** Source fields a derived card may take as-is. */
export const DERIVED_FIELDS = ['note.bilingual.en', 'note.bilingual.vi', 'problem.title'] as const
/** Placeholders a derived card's text template may use. */
export const TEMPLATE_PLACEHOLDERS = [
  'problem.title',
  'problem.leetcode',
  'problem.difficulty',
] as const

const PLACEHOLDER = /\{([^{}]*)\}/g
const PLACEHOLDER_LIST = TEMPLATE_PLACEHOLDERS.map((name) => `{${name}}`).join(', ')

/** The problems in `template`: placeholders outside the list, and braces that open no placeholder. */
function templateProblems(template: string): string[] {
  const known: readonly string[] = TEMPLATE_PLACEHOLDERS
  const problems = [...template.matchAll(PLACEHOLDER)]
    .map((match) => match[1] ?? '')
    .filter((name) => !known.includes(name))
    .map((name) => `unknown placeholder {${name}}`)
  if (/[{}]/.test(template.replace(PLACEHOLDER, ''))) problems.push('unbalanced { or }')
  return problems
}

const templateValueSchema = z.strictObject({
  template: nonEmptyText.superRefine((template, ctx) => {
    for (const problem of templateProblems(template)) {
      ctx.addIssue({ code: 'custom', message: `${problem}; placeholders: ${PLACEHOLDER_LIST}` })
    }
  }),
})

const mapValueSchema = z.union([z.enum(DERIVED_FIELDS), templateValueSchema], {
  error: `expected one of ${DERIVED_FIELDS.join(', ')} or { template: "…" }`,
})

/** A deck whose cards are built from another track's items (one card per source problem). */
export const derivedDeckSchema = z.strictObject({
  id: localIdSchema,
  kind: z.literal('derived'),
  title: localizedTextSchema.optional(),
  from: z.strictObject({ track: trackIdSchema, itemType: z.literal('problem') }),
  /** The card unlocks once its source problem has any result. */
  unlock: z.literal('attempted'),
  map: z.strictObject({
    front: mapValueSchema,
    back: mapValueSchema,
    hint: mapValueSchema.optional(),
  }),
})

// ---------------------------------------------------------------------------------------------
// The manifest (§3.4)
// ---------------------------------------------------------------------------------------------

const throttleRuleSchema = z.strictObject({
  dueAbove: nonNegativeInt,
  newPerDay: nonNegativeInt,
})

const defaultsSchema = z.strictObject({
  budgetMinutes: budgetMinutesSchema(),
  newPerDay: nonNegativeInt.nullable(),
  throttle: z.array(throttleRuleSchema),
})

/** Roadmap IDs are the database's `roadmap_variant` values (slugs). */
const roadmapRefSchema = z.strictObject({
  id: slugSchema,
  recommendedBelowMinutes: positiveInt.optional(),
})

const roadmapsSchema = z
  .array(roadmapRefSchema)
  .min(1)
  .refine((roadmaps) => unique(roadmaps.map((roadmap) => roadmap.id)), {
    message: 'roadmap ids must be unique',
  })

/**
 * The first cycle in the topics' `requires` graph as a path (`['a', 'b', 'a']`), or `null` when
 * there is none. Topics are visited in file order, their requirements in list order; requirements
 * that name no topic are ignored (the manifest schema reports them separately).
 */
export function topicCycle(
  topics: readonly { id: string; requires: readonly string[] }[],
): string[] | null {
  const requires = new Map(topics.map((topic) => [topic.id, topic.requires]))
  const done = new Set<string>()
  const path: string[] = []

  const visit = (id: string): string[] | null => {
    const start = path.indexOf(id)
    if (start !== -1) return [...path.slice(start), id]
    if (done.has(id) || !requires.has(id)) return null
    path.push(id)
    for (const next of requires.get(id) ?? []) {
      const cycle = visit(next)
      if (cycle !== null) return cycle
    }
    path.pop()
    done.add(id)
    return null
  }

  for (const topic of topics) {
    const cycle = visit(topic.id)
    if (cycle !== null) return cycle
  }
  return null
}

const manifestShape = z.strictObject({
  id: trackIdSchema,
  status: z.enum(ITEM_STATUSES),
  title: localizedTextSchema,
  accent: z.enum(TRACK_ACCENTS),
  itemTypes: uniqueList(z.enum(ITEM_TYPES), 'itemTypes').min(1),
  codeLanguages: uniqueList(z.enum(CODE_LANGUAGES), 'codeLanguages').min(1).optional(),
  srs: srsSchema,
  review: reviewSchema.optional(),
  topics: z.array(topicSchema).default([]),
  lessonFormats: z
    .record(slugSchema, lessonFormatSchema, {
      error: (issue) =>
        issue.code === 'invalid_key'
          ? 'a lesson format ID is a slug ([a-z0-9][a-z0-9-], at most 32 characters)'
          : undefined,
    })
    .optional(),
  defaults: defaultsSchema,
  estimates: estimatesSchema,
  decks: z.array(derivedDeckSchema).default([]),
  roadmaps: roadmapsSchema,
  weeklyTemplate: weeklyTemplateSchema,
})

type ManifestShape = z.infer<typeof manifestShape>

/** The cross-field rules of §3.4 / §3.6, each reported at the field to fix. */
function checkManifest(manifest: ManifestShape, ctx: z.RefinementCtx): void {
  const listed = new Set<ItemType>(manifest.itemTypes)
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: 'custom', path, message })

  for (const type of manifest.itemTypes) {
    if (manifest.estimates[type] === undefined) {
      issue(['estimates', type], `the track lists ${type}, so estimates.${type} is required`)
    }
  }

  if (listed.has('problem')) {
    if (manifest.review === undefined) {
      issue(['review'], 'a track with problems needs review (recallMinutes, redoFactor)')
    }
    if (manifest.codeLanguages === undefined) {
      issue(['codeLanguages'], 'a track with problems needs codeLanguages')
    }
  }

  const formats = Object.keys(manifest.lessonFormats ?? {}).length
  if (listed.has('lesson') && formats === 0) {
    issue(['lessonFormats'], 'a track with lessons needs at least one lesson format')
  } else if (!listed.has('lesson') && manifest.lessonFormats !== undefined) {
    issue(['lessonFormats'], 'lessonFormats needs lesson in itemTypes')
  }

  for (const type of Object.keys(manifest.srs.byType ?? {})) {
    if (!listed.has(type as ItemType)) {
      issue(['srs', 'byType', type], `srs.byType.${type} needs ${type} in itemTypes`)
    }
  }

  const topicIds = new Set<string>()
  manifest.topics.forEach((topic, index) => {
    if (topicIds.has(topic.id)) issue(['topics', index, 'id'], `duplicate topic ${topic.id}`)
    topicIds.add(topic.id)
  })
  manifest.topics.forEach((topic, index) => {
    topic.requires.forEach((required, position) => {
      if (!topicIds.has(required)) {
        issue(['topics', index, 'requires', position], `${required} is not a topic of this track`)
      }
    })
  })
  const cycle = topicCycle(manifest.topics)
  if (cycle !== null) issue(['topics'], `topic requires form a cycle: ${cycle.join(' → ')}`)

  if (manifest.decks.length > 0 && !listed.has('flashcard')) {
    issue(['decks'], 'derived decks need flashcard in itemTypes')
  }
  const deckIds = new Set<string>()
  manifest.decks.forEach((deck, index) => {
    if (deckIds.has(deck.id)) issue(['decks', index, 'id'], `duplicate deck ${deck.id}`)
    deckIds.add(deck.id)
  })

  for (const day of WEEKDAY_KEYS) {
    manifest.weeklyTemplate[day]?.forEach((block, index) => {
      if (block.kind === 'practice' && block.itemType !== undefined) {
        if (!listed.has(block.itemType)) {
          issue(
            ['weeklyTemplate', day, index, 'itemType'],
            `the track does not list ${block.itemType} in itemTypes`,
          )
        }
      }
    })
  }
}

/**
 * A track manifest (platform design §3.4), strict everywhere: an unknown key is an error. The
 * cross-field rules (estimates per listed type, problem ⇒ review and code languages, lesson ⇔
 * lesson formats, SRS overrides, topic graph, decks, practice item types) run once the fields
 * themselves are valid.
 */
export const trackManifestSchema = manifestShape.superRefine(checkManifest, whenFieldsValid)

export type TrackManifest = z.infer<typeof trackManifestSchema>
export type WeeklyTemplate = TrackManifest['weeklyTemplate']
export type RoadmapRef = TrackManifest['roadmaps'][number]
export type Topic = z.infer<typeof topicSchema>
export type LessonFormat = z.infer<typeof lessonFormatSchema>
export type LessonRule = (typeof LESSON_RULES)[number]
export type DerivedDeck = z.infer<typeof derivedDeckSchema>
/** What `estimateMinutes` reads from a manifest (§5.4). */
export type TrackEstimates = Pick<TrackManifest, 'estimates' | 'review'>
