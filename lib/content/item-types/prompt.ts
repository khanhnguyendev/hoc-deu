/**
 * Prompts, `prompts/*.yaml` (platform design §3.5): speaking and writing tasks chosen by a
 * template's `tag` — weekly ones by `week`, repeatable ones (the mock interview) any week.
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
import { LOCAL_ID_PREFIX, prefixedItemIdSchema, slugSchema } from '../schemas/ids'
import { requireEstimate, type ItemTypeCore } from './types'

export const promptSchema = z
  .strictObject({
    id: prefixedItemIdSchema(LOCAL_ID_PREFIX.prompt),
    tag: slugSchema,
    week: z.number().int().positive().optional(),
    instruction: localizedTextSchema,
    rubric: z.array(nonEmptyText).default([]),
    /** The prompt's own length; `estimates.prompt` otherwise. */
    minutes: z.number().int().positive().optional(),
    repeatable: z.boolean().default(false),
    status: itemStatusSchema,
    ...provenanceShape,
  })
  .superRefine((prompt, ctx) => {
    if (prompt.repeatable === (prompt.week !== undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['week'],
        message: prompt.repeatable
          ? 'a repeatable prompt has no week'
          : 'a prompt has a week, or repeatable: true',
      })
    }
    checkProvenance(prompt, ctx)
  }, whenFieldsValid)

export const promptsFileSchema = z.array(promptSchema).min(1)

export type Prompt = z.infer<typeof promptSchema>

export const promptType: ItemTypeCore<Prompt> = {
  type: 'prompt',
  schema: promptSchema,
  outcomes: {},
  srs: false,
  estimateMinutes: (prompt, { estimates }) =>
    prompt.minutes ?? requireEstimate(estimates.prompt, 'estimates.prompt'),
}
