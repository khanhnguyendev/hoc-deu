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
  /**
   * /onboarding, the setup wizard (§2.4, task 2.10). `{minutes}` is a formatted number of
   * minutes.
   */
  onboarding: {
    pageTitle: 'Thiết lập lộ trình',
    title: 'Chào mừng bạn đến Học Đều',
    description: 'Tài khoản của bạn đã được duyệt. Thiết lập lộ trình học trong vài bước ngắn.',
    steps: {
      tracks: 'Chọn lộ trình',
      minutes: 'Thời gian mỗi ngày',
      variant: 'Phiên bản lộ trình',
      schedule: 'Lịch học',
      language: 'Ngôn ngữ lập trình',
      preview: 'Xem trước tuần học',
    },
    back: 'Quay lại',
    next: 'Tiếp tục',
    submit: 'Bắt đầu học',
    tracks: {
      description: 'Bạn có thể học nhiều lộ trình cùng lúc.',
      suggested: '{minutes} phút mỗi ngày',
    },
    minutes: {
      description: 'Chọn số phút bạn có thể học đều đặn mỗi ngày cho từng lộ trình.',
      helper: 'phút mỗi ngày',
    },
    variant: {
      description:
        'Phiên bản được gợi ý theo số phút mỗi ngày của bạn. Bạn vẫn có thể chọn phiên bản khác.',
    },
    schedule: {
      description: 'Học Đều tính ngày học theo múi giờ và giờ bắt đầu ngày của bạn.',
      startDate: 'Ngày bắt đầu',
      startDateHelper: 'Từ hôm nay đến tối đa 60 ngày tới.',
      timezone: 'Múi giờ',
      dayStart: 'Ngày mới bắt đầu lúc',
      dayStartHelper: 'Học lúc 01:30 vẫn tính cho ngày hôm trước khi ngày mới bắt đầu lúc 04:00.',
    },
    language: {
      description: 'Dùng cho lời giải và code mẫu. Bạn có thể đổi lại trong Cài đặt.',
      python: 'Python',
      java: 'Java',
      go: 'Go',
    },
    preview: {
      description: 'Mỗi tuần học của bạn sẽ theo mẫu này. Kế hoạch mỗi ngày được tạo từ đây.',
    },
    /** Field and form errors, in the wizard and from `completeOnboarding`. */
    errors: {
      invalid: 'Không đọc được thông tin thiết lập. Bạn tải lại trang rồi thử lại nhé.',
      noTrack: 'Chọn ít nhất một lộ trình.',
      duplicateTrack: 'Mỗi lộ trình chỉ được chọn một lần.',
      unknownTrack: 'Lộ trình này hiện không có. Bạn tải lại trang nhé.',
      minutes: 'Nhập số phút từ 10 đến 240, bước 5 phút.',
      variant: 'Chọn một phiên bản có trong lộ trình.',
      startDate: 'Chọn một ngày bắt đầu hợp lệ.',
      startDateTooLate: 'Ngày bắt đầu chỉ được muộn nhất 60 ngày kể từ hôm nay.',
      timezone: 'Múi giờ không hợp lệ.',
      dayStart: 'Chọn giờ từ 00:00 đến 12:00, mỗi 30 phút.',
      codeLanguage: 'Chọn Python, Java hoặc Go.',
      codeLanguageUnused: 'Lộ trình bạn chọn không dùng ngôn ngữ lập trình.',
    },
  },
  /** Shared track pieces (`features/tracks`): the weekly template preview. */
  tracks: {
    throttleTitle: 'Giới hạn thẻ mới',
  },
  /**
   * /admin/users, the approval queue (§2.4, task 2.8). `{count}`, `{date}` and `{name}` are
   * replaced with a formatted number, a formatted day and the user's name.
   */
  admin: {
    users: {
      pending: 'Chờ duyệt ({count})',
      active: 'Đang hoạt động',
      suspended: 'Tạm khoá',
      rejected: 'Bị từ chối',
      emptyPending: 'Không có tài khoản nào chờ duyệt.',
      emptyActive: 'Không có tài khoản nào đang hoạt động.',
      emptySuspended: 'Không có tài khoản nào bị tạm khoá.',
      emptyRejected: 'Không có tài khoản nào bị từ chối.',
      adminBadge: 'Quản trị viên',
      you: 'Bạn',
      joined: 'Tham gia {date}',
      unnamed: 'Chưa có tên',
      actionsFor: 'Thao tác với {name}',
    },
    actions: {
      approve: 'Duyệt',
      reject: 'Từ chối',
      suspend: 'Tạm khoá',
      reactivate: 'Kích hoạt lại',
      promote: 'Đặt làm quản trị',
      demote: 'Bỏ quyền quản trị',
    },
    /** ConfirmDialog copy for the actions that need a second step (reject, suspend, roles). */
    confirm: {
      reject: {
        title: 'Từ chối tài khoản của {name}?',
        description: 'Người này sẽ không dùng được Học Đều. Bạn có thể kích hoạt lại sau.',
      },
      suspend: {
        title: 'Tạm khoá tài khoản của {name}?',
        description: 'Người này sẽ không dùng được Học Đều cho đến khi được kích hoạt lại.',
      },
      promote: {
        title: 'Đặt {name} làm quản trị viên?',
        description: 'Quản trị viên có thể duyệt, tạm khoá và đổi quyền của các tài khoản khác.',
      },
      demote: {
        title: 'Bỏ quyền quản trị của {name}?',
        description: 'Tài khoản này sẽ trở lại là học viên và không vào được trang quản trị.',
      },
    },
    /** Toasts after a successful action. */
    results: {
      approved: 'Đã duyệt tài khoản.',
      rejected: 'Đã từ chối tài khoản.',
      suspended: 'Đã tạm khoá tài khoản.',
      reactivated: 'Đã kích hoạt lại tài khoản.',
      promoted: 'Đã đặt làm quản trị viên.',
      demoted: 'Đã bỏ quyền quản trị.',
    },
    /** The admin functions' error codes (20260925000300_rpc.sql), shown in the row and a toast. */
    errors: {
      invalid: 'Yêu cầu không hợp lệ.',
      self: 'Bạn không thể thay đổi tài khoản của chính mình.',
      notFound: 'Không tìm thấy tài khoản này. Bạn tải lại trang nhé.',
      changed: 'Tài khoản đã đổi trạng thái. Bạn tải lại trang nhé.',
      noChange: 'Tài khoản đã có quyền này. Bạn tải lại trang nhé.',
      failed: 'Không thực hiện được thao tác. Bạn thử lại nhé.',
    },
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
