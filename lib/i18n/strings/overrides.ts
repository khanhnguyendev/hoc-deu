/**
 * "Điều chỉnh lộ trình bởi AI" (§2.4 `/settings`, §5.12, §5.9; task 6.6c): the learner's list of
 * the AI's roadmap overrides and "Thu hồi". `{…}` placeholders are filled with `fill` /
 * `withTitle` (`lib/i18n/format`). Part B-M6 decision 3: only task 6.6c edits this file, in its
 * wave.
 */
export const overrides = {
  title: 'Điều chỉnh lộ trình bởi AI',
  description:
    'Bot AI đã điều chỉnh lộ trình của bạn như dưới đây. Bạn có thể thu hồi bất kỳ điều chỉnh nào.',
  /** One line per override, by kind. */
  kinds: {
    insertBlock: 'Thêm {minutes} phút luyện {topic} vào {weekdays} đến {until}',
    extraWeek: 'Một tuần luyện thêm chủ đề {topic}: còn {days} ngày học',
    reorder: 'Đổi thứ tự các chủ đề sắp tới',
  },
  /** Weekdays as the list names them (Monday first, as the heatmap). */
  weekdays: { mon: 'T2', tue: 'T3', wed: 'T4', thu: 'T5', fri: 'T6', sat: 'T7', sun: 'CN' },
  /** An override kept while the AI flag is off (§5.12: suspended, not applied). */
  suspended: 'Tạm dừng (đã tắt cá nhân hoá AI)',
  revoke: {
    action: 'Thu hồi',
    /** The button's accessible name: the action, the override's line and its track (unique). */
    actionLabel: 'Thu hồi: {title} ({track})',
    title: 'Thu hồi điều chỉnh này?',
    description: 'Thay đổi có hiệu lực từ kế hoạch ngày mai.',
    confirm: 'Thu hồi',
    done: 'Đã thu hồi. Thay đổi có hiệu lực từ kế hoạch ngày mai.',
    already: 'Điều chỉnh này đã được thu hồi.',
    notFound: 'Không tìm thấy điều chỉnh này. Trang đã được làm mới.',
  },
  error: 'Không tải được các điều chỉnh lộ trình. Hãy tải lại trang.',
  /**
   * The practice blocks overrides add to a plan (§5.12), by tag: an `insert_block`'s block and the
   * one that replaces the new items during an `extra_week`. `/today`'s block label lookup
   * (`vi.today.practice`) spreads these in, so the label is defined once.
   */
  blockTags: {
    'topic-practice': 'Luyện thêm chủ đề',
    'extra-week': 'Tuần luyện thêm',
  },
} as const
