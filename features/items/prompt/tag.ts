import { vi } from '@/lib/i18n/vi'
import { own } from '../components/mdx/copy'

/** The template tag's label (`vi.template.tags`, one source with the weekly template); else its ID. */
export const promptTagLabel = (tag: string): string => own<string>(vi.template.tags, tag) ?? tag
