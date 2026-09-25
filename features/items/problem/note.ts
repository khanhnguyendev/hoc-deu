import type { ProblemNote } from '@/lib/content/catalog-types'

/**
 * Whether a problem's note shows (§3.3): a draft note only to admins — a learner sees "Chưa có
 * ghi chú" while the problem stays active; an active or retired note to everyone.
 */
export function isNoteVisible(note: ProblemNote | null, isAdmin: boolean): note is ProblemNote {
  return note !== null && (note.status !== 'draft' || isAdmin)
}
