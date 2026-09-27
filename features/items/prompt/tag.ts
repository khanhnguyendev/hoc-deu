import { vi } from '@/lib/i18n/vi'
import { own } from '../components/mdx/copy'

/** The template tag's label (`vi.template.tags`, one source with the weekly template); else its ID. */
export const promptTagLabel = (tag: string): string => own<string>(vi.template.tags, tag) ?? tag

/**
 * The tag of the repeatable mock-interview prompt (§5.6): its page shows the problem
 * `mockInterviewProblem` picks (M4 decision 24; task 5.2c). Compared by equality, like a
 * practice block's tag.
 */
export const MOCK_INTERVIEW_TAG = 'mock-interview'
