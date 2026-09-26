import { StatusPill } from '@/components/patterns/status-pill'
import type { ReviewItemSlot } from '../slots'

/**
 * The other due items (§2.4): each one's registry row (`reviewRows`, built by the page) and, when
 * it is Weak, the "Yếu" pill under the row — as `BlockItemList` shows a problem's "Chưa có ghi
 * chú". Nothing when there is nothing to show (the card session or the page's EmptyState covers
 * that instead).
 */
function ReviewList({ items }: { items: readonly ReviewItemSlot[] }) {
  if (items.length === 0) return null
  return (
    <ul role="list" data-slot="review-list" className="-mx-3 flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.itemId} className="flex flex-col">
          {item.row}
          {item.weak && (
            <p className="px-3 pb-1">
              <StatusPill status="weak" />
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

export { ReviewList }
