import { Dumbbell } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { Difficulty } from '@/lib/content/item-types/problem'
import { vi } from '@/lib/i18n/vi'

/** What `<Practice problem>` resolves to (bound per page, `features/items/mdx/bind.tsx`). */
export type PracticeTarget = {
  title: string
  href: string
  leetcode: number | null
  difficulty: Difficulty | null
}

const DIFFICULTY_TONE = { E: 'success', M: 'warning', H: 'danger' } as const

/**
 * The practice problem of a lesson as a link card: "Bài luyện tập", `#leetcode`, the English title
 * (`lang="en"`) and the difficulty as text on a soft badge (never colour alone).
 */
function PracticeCard({ title, href, leetcode, difficulty }: PracticeTarget) {
  return (
    <Link href={href} data-slot="practice-card" className="block rounded-lg">
      <Card interactive className="gap-1 md:gap-1">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Dumbbell aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
          {vi.content.practice.title}
          {leetcode !== null && <span className="font-mono">#{leetcode}</span>}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <span lang="en" className="font-semibold text-foreground">
            {title}
          </span>
          {difficulty !== null && (
            <Badge tone={DIFFICULTY_TONE[difficulty]}>
              {vi.content.practice.difficulty[difficulty]}
            </Badge>
          )}
        </span>
      </Card>
    </Link>
  )
}

export { PracticeCard }
