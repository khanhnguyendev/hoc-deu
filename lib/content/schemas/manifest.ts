import { z } from 'zod'

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

/**
 * A weekly-template block (platform design §3.4, §5.4). M3 may add per-`kind` field rules; for
 * now every optional field is allowed on every kind.
 */
export const templateBlockSchema = z.strictObject({
  kind: z.enum(['review', 'new', 'practice', 'recap']),
  maxMinutes: positiveInt.optional(),
  minutes: positiveInt.optional(),
  tag: z.string().min(1).optional(),
  itemType: z.string().min(1).optional(),
  fromWeek: positiveInt.optional(),
  count: positiveInt.optional(),
})
export type TemplateBlock = z.infer<typeof templateBlockSchema>

const WEEKDAY_KEYS = ['mon-fri', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

/**
 * Zod 4's `z.record` with an enum key type requires every key to be present; `z.partialRecord`
 * relaxes that (a manifest lists only the days it needs) while still rejecting a key outside the
 * enum (an unknown weekday).
 */
export const weeklyTemplateSchema = z.partialRecord(
  z.enum(WEEKDAY_KEYS),
  z.array(templateBlockSchema).min(1),
)

const throttleRuleSchema = z.strictObject({
  dueAbove: nonNegativeInt,
  newPerDay: nonNegativeInt,
})

/** Minutes per track: 10–240 in steps of 5 (decision 22, platform design §5.9). */
const budgetMinutesSchema = z.number().int().min(10).max(240).multipleOf(5)

const defaultsSchema = z.strictObject({
  budgetMinutes: budgetMinutesSchema,
  newPerDay: nonNegativeInt.nullable(),
  throttle: z.array(throttleRuleSchema),
})

const roadmapRefSchema = z.strictObject({
  id: z.string().min(1),
  recommendedBelowMinutes: positiveInt.optional(),
})

const roadmapsSchema = z
  .array(roadmapRefSchema)
  .min(1)
  .refine((roadmaps) => new Set(roadmaps.map((roadmap) => roadmap.id)).size === roadmaps.length, {
    message: 'roadmap ids must be unique',
  })

/**
 * A track manifest (platform design §3.4). Loose at the top level: `topics`, `srs`, `review`,
 * `estimates`, `decks`, `lessonFormats` and any other unlisted field pass through unchecked — M3
 * (task 3.1) adds their full schema (signals, lesson formats, decks validation) and tightens these
 * loose parts.
 */
export const trackManifestSchema = z.looseObject({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/),
  status: z.enum(['draft', 'active', 'retired']),
  title: z.strictObject({ vi: z.string().min(1), en: z.string().min(1) }),
  accent: z.enum(TRACK_ACCENTS),
  itemTypes: z.array(z.string().min(1)).min(1),
  codeLanguages: z.array(z.string().min(1)).optional(),
  defaults: defaultsSchema,
  roadmaps: roadmapsSchema,
  weeklyTemplate: weeklyTemplateSchema,
})

export type TrackManifest = z.infer<typeof trackManifestSchema>
export type WeeklyTemplate = TrackManifest['weeklyTemplate']
export type RoadmapRef = TrackManifest['roadmaps'][number]
