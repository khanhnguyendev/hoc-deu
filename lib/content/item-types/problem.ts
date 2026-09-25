/** Problems, `problems/lc-<nnnn>-<slug>/problem.yaml` and `note.mdx` (platform design §3.5). */
import { z } from 'zod'
import {
  checkProvenance,
  httpsUrlSchema,
  itemStatusSchema,
  nonEmptyText,
  provenanceShape,
  whenFieldsValid,
} from '../schemas/common'
import {
  LOCAL_ID_PREFIX,
  parseItemId,
  prefixedItemIdSchema,
  problemLocalId,
  slugSchema,
} from '../schemas/ids'
import { requireEstimate, type ItemTypeCore } from './types'

export const DIFFICULTIES = ['E', 'M', 'H'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

/**
 * A problem: a link to LeetCode plus our own metadata — never the statement (§3.5). `title` is
 * LeetCode's English title, never translated. A premium problem lists at least one free
 * alternative.
 */
export const problemSchema = z
  .strictObject({
    id: prefixedItemIdSchema(LOCAL_ID_PREFIX.problem),
    leetcode: z.number().int().min(1).max(99999),
    title: nonEmptyText,
    difficulty: z.enum(DIFFICULTIES),
    topic: slugSchema,
    premium: z.boolean().default(false),
    alternatives: z.array(z.strictObject({ label: nonEmptyText, url: httpsUrlSchema })).default([]),
    status: itemStatusSchema,
    ...provenanceShape,
  })
  .superRefine((problem, ctx) => {
    const expected = problemLocalId(problem.leetcode)
    if (parseItemId(problem.id)?.localId !== expected) {
      ctx.addIssue({
        code: 'custom',
        path: ['id'],
        message: `LeetCode ${problem.leetcode} has the local ID ${expected}`,
      })
    }
    if (problem.premium && problem.alternatives.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['alternatives'],
        message: 'a premium problem needs at least one free alternative',
      })
    }
    checkProvenance(problem, ctx)
  }, whenFieldsValid)

/** A problem note's frontmatter: its own status (a draft note hides only the note, §3.3). */
export const noteFrontmatterSchema = z
  .strictObject({ status: itemStatusSchema, ...provenanceShape })
  .superRefine(checkProvenance, whenFieldsValid)

export type Problem = z.infer<typeof problemSchema>
export type NoteFrontmatter = z.infer<typeof noteFrontmatterSchema>

export const problemType: ItemTypeCore<Problem> = {
  type: 'problem',
  schema: problemSchema,
  outcomes: { solved: 'success', hint: 'partial', failed: 'fail' },
  srs: true,
  estimateMinutes(problem, { estimates, review }, mode) {
    const fresh = requireEstimate(estimates.problem, 'estimates.problem').new[problem.difficulty]
    if (mode === 'new') return fresh
    const modes = requireEstimate(review, 'review')
    // Quick recall, a review and explaining aloud cost the same (decision 12); redo re-solves.
    return mode === 'redo' ? Math.round(fresh * modes.redoFactor) : modes.recallMinutes
  },
}
