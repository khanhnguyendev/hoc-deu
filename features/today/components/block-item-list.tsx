import { vi } from '@/lib/i18n/vi'
import type { BlockItemSlot } from '../slots'

/**
 * A plan block's items: each one's registry row (built by the page, `todaySlots`) — a problem
 * without a visible note says "Chưa có ghi chú" in its own row (`showNoteHint`, ruling M5-R26;
 * §5.9, RF-4), so this list makes no item-type decision. A block without rows says so.
 */
function BlockItemList({ items }: { items: readonly BlockItemSlot[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{vi.today.block.noItems}</p>
  }
  return (
    <ul role="list" data-slot="block-item-list" className="-mx-3 flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.itemId}>{item.row}</li>
      ))}
    </ul>
  )
}

export { BlockItemList }
