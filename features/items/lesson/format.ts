import { vi } from '@/lib/i18n/vi'
import { own } from '../components/mdx/copy'

/** "Pattern", "Deep-dive"; a format without a label shows its ID (decision 33). */
export const lessonFormatLabel = (format: string): string =>
  own<string>(vi.items.lessonFormat, format) ?? format
