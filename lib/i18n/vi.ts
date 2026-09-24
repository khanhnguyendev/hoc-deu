/**
 * Vietnamese UI strings (DESIGN_SYSTEM §11). Technical terms stay English; learning content is
 * not here. Keep strings in NFC (tested) and sentence case.
 */
export const vi = {
  common: {
    close: 'Đóng',
    openMenu: 'Mở menu',
    loading: 'Đang tải…',
    retry: 'Thử lại',
    cancel: 'Huỷ',
    confirm: 'Xác nhận',
    skipToContent: 'Bỏ qua đến nội dung',
    notifications: 'Thông báo',
  },
  nav: {
    main: 'Điều hướng chính',
    today: 'Hôm nay',
    review: 'Ôn tập',
    roadmap: 'Lộ trình',
    progress: 'Tiến độ',
    settings: 'Cài đặt',
    admin: 'Quản trị',
    adminUsers: 'Người dùng',
    adminContent: 'Nội dung',
    account: 'Tài khoản',
    signOut: 'Đăng xuất',
    collapse: 'Thu gọn thanh bên',
    expand: 'Mở rộng thanh bên',
  },
  theme: {
    label: 'Giao diện',
    light: 'Sáng',
    dark: 'Tối',
    system: 'Theo hệ thống',
  },
  /** Spaced-repetition status (DESIGN_SYSTEM §3.3). */
  status: {
    notStarted: 'Chưa học',
    weak: 'Yếu',
    ok: 'Ổn',
    strong: 'Vững',
    mastered: 'Thành thạo',
    skipped: 'Đã bỏ qua',
  },
  /** Plan block check-in status (DESIGN_SYSTEM §3.3). */
  block: {
    done: 'Xong',
    partial: 'Một phần',
    skipped: 'Bỏ qua',
  },
  streak: {
    suffix: 'ngày liên tiếp',
  },
  heatmap: {
    legend: 'Chú giải',
    /** Minutes per level 0–4 (DESIGN_SYSTEM §3.4). */
    levels: ['0 phút', '1–15 phút', '16–40 phút', '41–75 phút', 'Trên 75 phút'],
    /** Monday first. */
    weekdays: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
    showTable: 'Xem dạng bảng',
    hideTable: 'Ẩn bảng',
    previousMonth: 'Tháng trước',
    nextMonth: 'Tháng sau',
    day: 'Ngày',
    minutes: 'Số phút',
    noActivity: 'Chưa có ngày học nào.',
    pickDay: 'Chọn một ngày để xem số phút đã học.',
  },
  states: {
    errorTitle: 'Không tải được dữ liệu',
    errorBody: 'Đã có lỗi xảy ra. Bạn thử lại nhé.',
    notFoundTitle: 'Không tìm thấy trang',
    notFoundBody: 'Trang bạn tìm không tồn tại hoặc đã được chuyển đi.',
    backHome: 'Về trang chủ',
    globalErrorTitle: 'Học Đều đang gặp sự cố',
    globalErrorBody: 'Ứng dụng không tải được. Bạn thử lại sau ít phút nhé.',
  },
  /** Save errors shown to the user (lib/events/apply.ts EventError.userMessage). */
  errors: {
    /** §4.5: the learner write quota (500 events per local day). */
    quotaExceeded: 'Bạn đã ghi nhận quá nhiều hoạt động hôm nay. Hãy thử lại vào ngày mai.',
    saveFailed: 'Không lưu được thay đổi. Bạn thử lại nhé.',
    notAllowed: 'Bạn không có quyền thực hiện thao tác này.',
    invalidTransition: 'Lộ trình đang ở trạng thái khác. Bạn tải lại trang nhé.',
    invalidTimezone: 'Múi giờ không hợp lệ.',
  },
  /** The component catalog at /dev/components (dev and preview only). */
  dev: {
    catalogTitle: 'Thư viện thành phần',
    catalogNav: 'Danh mục thành phần',
  },
  /** Form and focus-page primitives (DESIGN_SYSTEM §5 forms). */
  forms: {
    required: 'Bắt buộc',
    errorSummaryTitle: 'Vui lòng kiểm tra lại các mục sau',
    step: 'Bước',
  },
  /** /sign-in (platform design §2.3, §2.4). */
  auth: {
    signInTitle: 'Đăng nhập',
    signInDescription: 'Dùng tài khoản Google hoặc GitHub để bắt đầu học cùng Học Đều.',
    continueWithGoogle: 'Tiếp tục với Google',
    continueWithGitHub: 'Tiếp tục với GitHub',
    signInFailed: 'Đăng nhập không thành công. Bạn thử lại nhé.',
    testLoginTitle: 'Đăng nhập thử nghiệm',
    testLoginDescription: 'Chỉ có trên máy local và CI, với tài khoản thử nghiệm.',
    email: 'Email',
    password: 'Mật khẩu',
    submit: 'Đăng nhập',
    wrongCredentials: 'Email hoặc mật khẩu không đúng.',
    testLoginDisabled: 'Đăng nhập thử nghiệm không được bật.',
  },
  /** `/` (§2.4): the signed-out landing page (the h1 reuses the "Học Đều" wordmark). */
  landing: {
    positioning: 'Nền tảng học tập dẫn dắt bởi AI — mỗi ngày một chút, AI giúp bạn tiến đều.',
    signIn: 'Đăng nhập',
  },
  /** /pending, one entry per status that is not `active` (§2.4). */
  account: {
    pending: {
      title: 'Tài khoản của bạn đang chờ duyệt',
      description: 'Quản trị viên sẽ duyệt sớm. Trang này tự chuyển khi tài khoản được duyệt.',
    },
    rejected: {
      title: 'Tài khoản chưa được duyệt',
      description: 'Quản trị viên chưa duyệt tài khoản này. Nếu có nhầm lẫn, bạn hãy liên hệ họ.',
    },
    suspended: {
      title: 'Tài khoản đang tạm khoá',
      description: 'Quản trị viên đã tạm khoá tài khoản này. Bạn hãy liên hệ họ để mở lại.',
    },
  },
  /** /onboarding until the wizard arrives (task 2.10). */
  onboarding: {
    pageTitle: 'Thiết lập lộ trình',
    title: 'Chào mừng bạn đến Học Đều',
    description: 'Tài khoản của bạn đã được duyệt.',
    comingSoonTitle: 'Phần thiết lập lộ trình sắp có',
    comingSoonBody: 'Tại đây bạn sẽ chọn lộ trình, số phút mỗi ngày và lịch học của mình.',
  },
  /** /today until the dashboard arrives (task 5.1). */
  today: {
    comingSoonTitle: 'Kế hoạch hôm nay sắp có',
    comingSoonBody: 'Các khối học, check-in và thẻ cần ôn của bạn sẽ hiện ở đây.',
  },
  /**
   * `describeWeeklyTemplate` / `describeThrottle` (`lib/content/weekly-template.ts`, platform
   * design §3.4). `{n}`, `{count}`, `{w}`, `{dueAbove}` are replaced with formatted numbers.
   */
  template: {
    days: {
      'mon-fri': 'Thứ 2 – Thứ 6',
      mon: 'Thứ 2',
      tue: 'Thứ 3',
      wed: 'Thứ 4',
      thu: 'Thứ 5',
      fri: 'Thứ 6',
      sat: 'Thứ 7',
      sun: 'Chủ nhật',
    },
    review: 'Ôn tập',
    reviewMax: '(tối đa {n} phút)',
    newItems: 'Bài mới',
    recap: 'Ôn lại {count} bài',
    fromWeek: '(từ tuần {w})',
    /** Practice-block labels by `tag` or `itemType`; an unlisted key falls back to the raw value. */
    tags: {
      exercise: 'Bài tập',
      shadowing: 'Shadowing',
      'mock-interview': 'Phỏng vấn thử',
      'weekend-task': 'Nhiệm vụ cuối tuần',
    },
    throttle: {
      newPerDay: 'Tối đa {n} thẻ mới mỗi ngày',
      rule: 'Trên {dueAbove} thẻ cần ôn: {n} thẻ mới mỗi ngày',
      paused: 'Trên {dueAbove} thẻ cần ôn: tạm dừng thẻ mới',
    },
  },
} as const
