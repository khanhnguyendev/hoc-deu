import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Difficulty } from '@/lib/content/item-types/problem'
import { vi } from '@/lib/i18n/vi'

const TONE = { E: 'success', M: 'warning', H: 'danger' } as const

/** A problem's difficulty as LeetCode names it ("Easy" / "Medium" / "Hard"): text, never colour alone. */
function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <Badge tone={TONE[difficulty]} data-difficulty={difficulty}>
      {vi.items.difficulty[difficulty]}
    </Badge>
  )
}

/** A LeetCode Premium problem (§3.5): a lock and "Premium", on an outline badge. */
function PremiumBadge() {
  return (
    <Badge tone="outline" data-premium="">
      <Lock aria-hidden="true" strokeWidth={1.75} />
      {vi.items.problem.premium}
    </Badge>
  )
}

export { DifficultyBadge, PremiumBadge }
