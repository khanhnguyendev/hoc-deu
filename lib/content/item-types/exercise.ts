/**
 * Exercises, `exercises/*.yaml` (platform design §3.5): English weekday practice, chosen by
 * practice blocks through their `week` — completion only, never in the new-item queue.
 */
import { z } from 'zod'
import {
  checkProvenance,
  itemStatusSchema,
  localizedTextSchema,
  nonEmptyText,
  provenanceShape,
  rubricLangSchema,
  whenFieldsValid,
} from '../schemas/common'
import { LOCAL_ID_PREFIX, prefixedItemIdSchema, slugSchema } from '../schemas/ids'
import { requireEstimate, type ItemTypeCore } from './types'

export const EXERCISE_KINDS = ['fill-blank', 'respond', 'rewrite'] as const
/** Where a fill-blank text's gap is. */
export const BLANK = '{{blank}}'

const common = {
  id: prefixedItemIdSchema(LOCAL_ID_PREFIX.exercise),
  week: z.number().int().positive(),
  topic: slugSchema,
  instruction: localizedTextSchema,
  text: nonEmptyText,
  status: itemStatusSchema,
  ...provenanceShape,
}

/** Auto-graded: `answers` are compared case- and whitespace-insensitively (`gradeFillBlank`). */
const fillBlankSchema = z
  .strictObject({
    ...common,
    kind: z.literal('fill-blank'),
    answers: z.array(nonEmptyText).min(1),
    hint: nonEmptyText.optional(),
  })
  .superRefine((exercise, ctx) => {
    const blanks = exercise.text.split(BLANK).length - 1
    if (blanks !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['text'],
        message: `a fill-blank text holds ${BLANK} exactly once (found ${blanks})`,
      })
    }
    checkProvenance(exercise, ctx)
  }, whenFieldsValid)

/** Self-graded against sample answers and a rubric (§3.5). */
const writtenFields = {
  ...common,
  sampleAnswers: z.array(nonEmptyText).min(1),
  rubric: z.array(nonEmptyText).min(1),
  /** The rubric's language (M3-R5): `vi` unless set; sample answers are always English. */
  lang: rubricLangSchema,
}

export const exerciseSchema = z.discriminatedUnion('kind', [
  fillBlankSchema,
  z
    .strictObject({ ...writtenFields, kind: z.literal('respond') })
    .superRefine(checkProvenance, whenFieldsValid),
  z
    .strictObject({ ...writtenFields, kind: z.literal('rewrite') })
    .superRefine(checkProvenance, whenFieldsValid),
])

export const exercisesFileSchema = z.array(exerciseSchema).min(1)

export type Exercise = z.infer<typeof exerciseSchema>

/** NFC, trimmed, inner whitespace collapsed, lower-cased (§3.5; [RF-3]). */
const normalize = (text: string): string =>
  text.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en')

/**
 * §3.5: a correct answer is `pass`, or `close` when the hint was revealed first; anything else is
 * `miss`. Case- and whitespace-insensitive.
 */
export function gradeFillBlank(
  input: string,
  answers: readonly string[],
  hintRevealed: boolean,
): 'pass' | 'close' | 'miss' {
  const given = normalize(input)
  const correct = given !== '' && answers.some((answer) => normalize(answer) === given)
  if (!correct) return 'miss'
  return hintRevealed ? 'close' : 'pass'
}

export const exerciseType: ItemTypeCore<Exercise> = {
  type: 'exercise',
  schema: exerciseSchema,
  outcomes: { pass: 'success', close: 'partial', miss: 'fail' },
  srs: false,
  estimateMinutes: (_exercise, { estimates }) =>
    requireEstimate(estimates.exercise, 'estimates.exercise'),
}
