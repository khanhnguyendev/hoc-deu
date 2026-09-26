import { NotebookPen } from 'lucide-react'
import { vi } from '@/lib/i18n/vi'
import type { BlockItemSlot } from '../slots'

/**
 * A plan block's items: each one's registry row (built by the page, `todaySlots`), and under a
 * problem without a visible note "Chưa có ghi chú" (§5.9, RF-4) — the LeetCode link is enough to
 * study it. A block without rows says so.
 */
function BlockItemList({ items }: { items: readonly BlockItemSlot[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{vi.today.block.noItems}</p>
  }
  return (
    <ul role="list" data-slot="block-item-list" className="-mx-3 flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.itemId} className="flex flex-col">
          {item.row}
          {item.noNote && (
            <p className="flex items-center gap-1.5 px-3 pb-1 text-sm text-muted-foreground">
              <NotebookPen aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
              {vi.items.problem.noNote}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

export { BlockItemList }
