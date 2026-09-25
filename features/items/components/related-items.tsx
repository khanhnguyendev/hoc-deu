import { LinkRow } from '@/components/patterns/link-row'
import { vi } from '@/lib/i18n/vi'
import type { ItemLink } from '../types'

export type RelatedItem = { label: string; link: ItemLink }

/**
 * Items a page links to ("Bài liên quan"): a lesson's anchor, the problem it is about, its
 * practice problem; a problem's deep-dive lesson. Each a LinkRow — the role label first, then
 * `#leetcode` and the difficulty; LeetCode titles in `lang="en"`. Nothing when the list is empty.
 */
function RelatedItems({ items }: { items: readonly RelatedItem[] }) {
  if (items.length === 0) return null
  return (
    <ul
      role="list"
      aria-label={vi.items.related}
      data-slot="related-items"
      className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-1"
    >
      {items.map(({ label, link }) => (
        <li key={`${label}:${link.id}`}>
          <LinkRow
            href={link.href}
            title={link.title}
            titleLang={link.leetcode === null ? undefined : 'en'}
            meta={[
              label,
              link.leetcode === null ? null : `#${link.leetcode}`,
              link.difficulty === null ? null : vi.items.difficulty[link.difficulty],
            ]}
          />
        </li>
      ))}
    </ul>
  )
}

export { RelatedItems }
