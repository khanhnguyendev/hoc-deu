import type { ReviewItemSlot } from '../slots'

/**
 * The other due items (§2.4): each one's registry row (`reviewRows`, built by the page — the
 * "Yếu" pill and "Chưa có ghi chú" hint live inside the row's own link now, task 5.3 review,
 * finding M5). Renders nothing when empty (the card session or the page's EmptyState covers that
 * instead).
 */
function ReviewList({ items }: { items: readonly ReviewItemSlot[] }) {
  if (items.length === 0) return null
  return (
    <ul role="list" data-slot="review-list" className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.itemId}>{item.row}</li>
      ))}
    </ul>
  )
}

export { ReviewList }
