import { Dumbbell } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import type { Difficulty } from '@/lib/content/item-types/problem'
import { vi } from '@/lib/i18n/vi'
import { DifficultyBadge } from '../difficulty-badge'

/** What `<Practice problem>` resolves to (bound per page, `features/items/mdx/bind.tsx`). */
export type PracticeTarget = {
  title: string
  href: string
  leetcode: number | null
  difficulty: Difficulty | null
}

/**
 * The practice problem of a lesson as a link card: "Bài luyện tập", `#leetcode`, the English title
 * (`lang="en"`) and the difficulty as the one `DifficultyBadge` ("Easy" / "Medium" / "Hard",
 * M3-R3; text, never colour alone). The `{' '}`s between the parts keep the link's accessible
 * name as words; flex layout ignores them.
 */
function PracticeCard({ title, href, leetcode, difficulty }: PracticeTarget) {
  return (
    <Link href={href} data-slot="practice-card" className="block rounded-lg">
      <Card interactive className="gap-1 md:gap-1">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Dumbbell aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
          {vi.content.practice.title}
          {leetcode !== null && (
            <>
              {' '}
              <span className="font-mono">#{leetcode}</span>
            </>
          )}
        </span>{' '}
        <span className="flex flex-wrap items-center gap-2">
          <span lang="en" className="font-semibold text-foreground">
            {title}
          </span>
          {difficulty !== null && (
            <>
              {' '}
              <DifficultyBadge difficulty={difficulty} />
            </>
          )}
        </span>
      </Card>
    </Link>
  )
}

export { PracticeCard }
