/** Lessons, `lessons/<slug>.mdx` frontmatter (platform design §3.3, §3.4; decision 11). */
import { z } from 'zod'
import {
  checkProvenance,
  itemStatusSchema,
  nonEmptyText,
  provenanceShape,
  whenFieldsValid,
} from '../schemas/common'
import { itemIdSchema, LOCAL_ID_PREFIX, prefixedItemIdSchema, slugSchema } from '../schemas/ids'
import { requireEstimate, type ItemTypeCore } from './types'

/**
 * `format` picks one of the track's lesson formats; `anchor` / `practice` / `about` are problem IDs
 * the format may require (checked by `content:build`, §3.6).
 */
export const lessonFrontmatterSchema = z
  .strictObject({
    id: prefixedItemIdSchema(LOCAL_ID_PREFIX.lesson),
    format: slugSchema,
    topic: slugSchema,
    title: nonEmptyText,
    anchor: itemIdSchema.optional(),
    practice: itemIdSchema.optional(),
    about: itemIdSchema.optional(),
    status: itemStatusSchema,
    ...provenanceShape,
  })
  .superRefine(checkProvenance, whenFieldsValid)

export type LessonFrontmatter = z.infer<typeof lessonFrontmatterSchema>

export const lessonType: ItemTypeCore<LessonFrontmatter> = {
  type: 'lesson',
  schema: lessonFrontmatterSchema,
  outcomes: {},
  srs: false,
  estimateMinutes: (_lesson, { estimates }) =>
    requireEstimate(estimates.lesson, 'estimates.lesson'),
}
