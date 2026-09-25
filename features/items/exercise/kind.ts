import { vi } from '@/lib/i18n/vi'
import { own } from '../components/mdx/copy'

/** "Điền từ" / "Trả lời" / "Viết lại"; an unknown kind shows its ID. */
export const exerciseKindLabel = (kind: string): string =>
  own<string>(vi.items.exercise.kind, kind) ?? kind
