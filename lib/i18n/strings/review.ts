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
  /** RF-4: nothing at all due today (the unfiltered total is 0) — an EmptyState linking to /today. */
  emptyTitle: 'Không có bài nào cần ôn hôm nay',
  /** A `?track=` filter has 0 due while another track still does (task 5.3 review, finding M3). */
  emptyFilteredTitle: 'Lộ trình này không có bài nào cần ôn hôm nay',
} as const
