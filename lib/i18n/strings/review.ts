/** `/review` (task 5.3; Part B-M5 decision 3). */
export const review = {
  /** PageHeader's subtitle: the total due, under the current `?track=` filter. */
  due: '{n} mục cần ôn hôm nay',
  filters: {
    label: 'Lọc theo lộ trình',
    all: 'Tất cả',
  },
  cardsTitle: 'Thẻ',
  itemsTitle: 'Bài cần ôn',
  /** RF-4: nothing at all due today — an EmptyState linking to /today. */
  emptyTitle: 'Không có bài nào cần ôn hôm nay',
} as const
