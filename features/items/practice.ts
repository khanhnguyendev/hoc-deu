import type { PracticeTarget } from './mdx/bind'
import type { ItemLink } from './types'

/**
 * `resolvePractice` for `mdxComponentsFor`: a note's or lesson's `<Practice problem>` resolves
 * through the page's `resolveItem` (an unknown or hidden item renders nothing).
 */
export function practiceResolver(
  resolveItem: (id: string) => ItemLink | null,
): (id: string) => PracticeTarget | null {
  return (id) => {
    const link = resolveItem(id)
    if (link === null) return null
    const { title, href, leetcode, difficulty } = link
    return { title, href, leetcode, difficulty }
  }
}
