/** `/progress` (task 5.5; Part B-M5 decision 3, decision 24). `{range}` is `28/09 – 04/10`. */
export const progress = {
  /**
   * The week section's title (UI I-4): "tuần này" names only the current week; last week is
   * "Tuần trước", any earlier one its dates.
   */
  week: {
    current: 'Tuần này · {range}',
    previous: 'Tuần trước · {range}',
    earlier: 'Tuần {range}',
  },
  /** The week's stat cards: neutral labels, the section names the week (UI I-4). */
  minutes: 'Phút',
  completedDays: 'Ngày hoàn thành',
  itemsDone: 'Mục đã học',
  /** The bars' list: the week's minutes per enrolled track. */
  byTrack: 'Phút theo lộ trình',
  /** The days' list. */
  byDay: 'Theo ngày',
  heatmapLabel: 'Lịch học của bạn',
  weekNavLabel: 'Điều hướng tuần',
  previousWeek: 'Tuần trước',
  nextWeek: 'Tuần sau',
  /**
   * A day's plan completed or not — the "Ngày hoàn thành" count. Never "Chưa học" (an item status,
   * §3.3): a day studied without finishing a block still shows its minutes (§5.9).
   */
  dayDone: 'Hoàn thành',
  dayNotDone: 'Chưa hoàn thành',
  noTracksTitle: 'Bạn chưa theo lộ trình nào',
  /** RF-4: a brand-new learner with no daily_activity row at all. */
  emptyTitle: 'Chưa có ngày học nào — bắt đầu từ trang Hôm nay',
} as const
