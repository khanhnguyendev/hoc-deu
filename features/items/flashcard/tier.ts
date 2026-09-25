import { vi } from '@/lib/i18n/vi'
import { own } from '../components/mdx/copy'

/** "Cốt lõi" / "Mở rộng" / "Giải thích code"; an unknown tier shows its ID. */
export const tierLabel = (tier: string): string =>
  own<string>(vi.items.flashcard.tier, tier) ?? tier
