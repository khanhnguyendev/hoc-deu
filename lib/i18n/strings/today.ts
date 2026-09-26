/**
 * `/today` (Part B-M5 decision 3): only 5.1a, 5.1b and 5.4 edit this file, in their waves.
 * `{date}` is a formatted local day, `{minutes}` a formatted duration, `{n}` / `{week}` /
 * `{weeks}` formatted numbers, `{title}` a track title.
 */
export const today = {
  /** "Học tiếp hôm nay" — the answer of its action, per outcome (5.1a, §5.8). */
  resumeResult: {
    created: 'Đã tạo kế hoạch hôm nay từ phần học còn dang dở.',
    exists: 'Kế hoạch hôm nay đã được tạo.',
    notOffered: 'Lựa chọn này không còn khả dụng. Trang đã được làm mới.',
  },
  /** The plan's section (§2.4): today's plan, or the resumed / paused plan of its own date. */
  plan: {
    today: 'Kế hoạch hôm nay',
    ofDate: 'Kế hoạch ngày {date}',
    summary: '{blocks} khối · {minutes}',
  },
  /** Decision 32 of M4: the last seen plan resumed today is today's work. */
  resumed: 'Bạn đã tiếp tục lộ trình hôm nay — kế hoạch mới có vào ngày mai.',
  /** The paused view (§5.2, §5.8; DESIGN_SYSTEM §11: encouraging, never guilt-driven). */
  paused: {
    title: 'Lộ trình đang tạm dừng — hoàn thành ít nhất một phần để tiếp tục.',
    planDate: 'Kế hoạch ngày {date}',
    unfinished: 'Phần còn dang dở',
    resume: 'Học tiếp hôm nay',
  },
  /** A block's kind label (PlanBlockCard). */
  kind: {
    review: 'Ôn tập',
    new: 'Bài mới',
    recap: 'Ôn tuần {week}',
    recapFiller: 'Ôn lại',
    practice: 'Luyện tập',
    extra: 'Học thêm',
  },
  /** Practice blocks by `tag` or `itemType`; an unlisted one reads `kind.practice`. */
  practice: {
    exercise: 'Bài tập',
    shadowing: 'Shadowing',
    'mock-interview': 'Mock interview',
    'weekend-task': 'Nhiệm vụ cuối tuần',
  },
  block: {
    /** §5.4: a new item over the budget, or a practice block longer than the track budget. */
    overBudget: 'Dài hơn thời gian dự kiến',
    noItems: 'Khối này chưa có bài nào.',
    /** The plain checked-in status row (5.2b replaces it with CheckInStatus). */
    checkedIn: 'Đã check-in',
    auto: 'tự động',
  },
  /** The `shadowing` block (§5.6): example sentences read aloud. */
  shadowing: {
    title: 'Đọc to các câu sau',
    empty: 'Chưa có câu mẫu cho khối này.',
  },
  /** DESIGN_SYSTEM §5 dashboard order: streak + per-track progress → due reviews. */
  stats: {
    title: 'Tiến độ',
    due: 'Cần ôn hôm nay',
    dueHint: 'Mở Ôn tập',
    week: 'Tuần {week}/{weeks}',
    dueCount: '{n} mục cần ôn',
    progress: 'Tiến độ {title}',
  },
  /** §5.5 throttle: why fewer new cards today. */
  throttle: {
    message: 'Đang có {n} thẻ cần ôn — tạm giảm thẻ mới.',
    action: 'Ôn tập',
  },
  /** §5.7 weak topics: ≥ 2 Weak items. */
  weakAreas: {
    title: 'Chủ đề cần củng cố',
    count: '{n} bài yếu',
    empty: 'Chưa có chủ đề nào cần củng cố.',
  },
  /** The states without a plan to show (RF-4). */
  empty: {
    notStarted: {
      title: 'Bắt đầu vào {date}',
      description:
        'Kế hoạch đầu tiên của bạn sẽ có vào ngày bắt đầu. Bạn có thể xem trước lộ trình.',
      action: 'Xem lộ trình',
    },
    noTracks: {
      title: 'Bạn chưa học lộ trình nào',
      description: 'Thêm hoặc tiếp tục một lộ trình trong Cài đặt để có kế hoạch mỗi ngày.',
      action: 'Mở Cài đặt',
    },
    noBlocks: {
      title: 'Hôm nay không có bài nào',
      description: 'Bạn có thể ôn lại bài đã học hoặc xem lộ trình.',
      action: 'Xem lộ trình',
    },
    unreadable: {
      title: 'Không đọc được kế hoạch hôm nay',
      description:
        'Kế hoạch hôm nay đã được dùng nhưng không đọc được. Bạn tải lại trang sau ít phút nhé.',
    },
  },
  /** `app/(app)/today/error.tsx`. */
  error: {
    title: 'Không tải được kế hoạch hôm nay',
  },
} as const
