/**
 * `/admin/bot` and the AI flag in `/admin/users` (§2.4, §6.2, §6.3; ADR-0026; Part B-M6 decision
 * 3): only tasks 6.3 and 6.4a edit this file, in their waves. `{time}` is a clock time, `{day}` a
 * formatted day, `{max}` and `{count}` formatted numbers, `{name}` a display name (inserted
 * literally), `{n}` a publish run's number, `{status}` / `{reason}` labels below.
 */
export const adminBot = {
  /** The sidebar entry and the page title. */
  nav: 'Bot AI',
  description: 'Công tắc của bot, chế độ chạy thử, giới hạn mỗi lần chạy và token truy cập.',
  /** `BOT_API_ENABLED` is not `true`: the switch below cannot turn the bot on by itself. */
  apiDisabled:
    'Chưa bật API bot: biến môi trường BOT_API_ENABLED đang tắt, nên mọi yêu cầu của bot đều bị từ chối. Biến này chỉ đổi được khi triển khai lại.',
  controls: {
    title: 'Điều khiển',
    enabled: {
      label: 'Bật bot',
      description: 'Khi tắt, mọi yêu cầu của bot đều bị từ chối và không có gì được ghi.',
    },
    dryRun: {
      label: 'Chạy thử (dry-run)',
      description:
        'Bot kiểm tra đầy đủ nhưng chỉ lưu đề xuất: không ghi kế hoạch, mục riêng hay điều chỉnh lộ trình.',
    },
    contentProposals: {
      label: 'Đề xuất nội dung',
      description: 'Bot được mở pull request đề xuất nội dung mới cho kho nội dung.',
    },
    cap: {
      label: 'Số người dùng tối đa mỗi lần chạy',
      description: 'Từ 1 đến {max} (giới hạn cứng).',
      save: 'Lưu',
      invalid: 'Nhập một số nguyên từ 1 đến {max}.',
    },
  },
  token: {
    title: 'Token truy cập',
    none: 'Chưa có token',
    /** A token exists but its creation time is unknown. */
    exists: 'Đã có token',
    current: 'Token hiện tại tạo lúc {time}',
    previous: 'Token cũ còn dùng được đến {time}',
    rotate: 'Tạo token mới',
    /** The first token: no old one to keep working. */
    confirmFirst: {
      title: 'Tạo token đầu tiên?',
      description:
        'Bot sẽ dùng token này để gọi API. Token chỉ hiện một lần: hãy sao chép ngay rồi đặt cho Routine và GitHub.',
    },
    confirm: {
      title: 'Tạo token mới?',
      description:
        'Token cũ vẫn dùng được thêm 24 giờ rồi hết hạn. Hãy cập nhật token mới cho Routine và GitHub trong thời gian đó.',
    },
    newToken: 'Token mới',
    shownOnce: 'Token chỉ hiện một lần',
    shownOnceHint: 'Sao chép ngay: tải lại trang là token này không hiện lại nữa.',
    copy: 'Sao chép',
    copied: 'Đã sao chép token.',
    copyFailed: 'Không sao chép được. Bạn chọn token và sao chép thủ công nhé.',
  },
  /** `{time}, {day}` — e.g. `10:00, 28 tháng 9, 2026` (Asia/Ho_Chi_Minh). */
  at: '{time}, {day}',
  /** The AI flag in `/admin/users` (decision 34). */
  aiFlag: {
    label: 'Cá nhân hoá AI',
    /** After the label in the switch's accessible name: each row's switch is named with its account. */
    forName: 'cho {name}',
    inactive: 'Chỉ đổi được cho tài khoản đang hoạt động.',
    /** `no_change`: another admin flipped it first. */
    changed: 'Cá nhân hoá AI của tài khoản này vừa được đổi. Bạn tải lại trang nhé.',
  },
  results: {
    saved: 'Đã lưu cài đặt bot.',
    rotated: 'Đã tạo token mới.',
    aiOn: 'Đã bật cá nhân hoá AI.',
    aiOff: 'Đã tắt cá nhân hoá AI.',
  },
  errors: {
    invalid: 'Cài đặt bot không hợp lệ.',
    failed: 'Không lưu được cài đặt bot. Bạn thử lại nhé.',
    rotateFailed: 'Không tạo được token mới. Bạn thử lại nhé.',
  },
  /** `/admin/bot`'s run log (`admin_bot_runs(20)`; task 6.4a, §6.2). */
  runLog: {
    title: 'Nhật ký chạy',
    description: '20 lần chạy gần nhất, mới nhất trước. Chỉ có số đếm, không có người dùng nào.',
    /** The table's accessible name (its scroll region). */
    label: 'Các lần chạy gần nhất của bot',
    columns: {
      run: 'Lần chạy',
      kind: 'Loại',
      mode: 'Chế độ',
      status: 'Trạng thái',
      eligible: 'Đủ điều kiện',
      pending: 'Đang chờ',
      applied: 'Đã áp dụng',
      dryRun: 'Chạy thử',
      skipped: 'Bỏ qua',
      invalid: 'Không hợp lệ',
      error: 'Lỗi',
      deferred: 'Hoãn',
      pr: 'Pull request',
      summary: 'Tóm tắt',
    },
    /** Under the run's date: when it started (Asia/Ho_Chi_Minh). */
    startedAt: 'bắt đầu {time}',
    kind: { plan: 'Kế hoạch', publish: 'Xuất bản {n}' },
    mode: { live: 'Chạy thật', dry_run: 'Chạy thử' },
    status: { running: 'Đang chạy', completed: 'Hoàn tất', failed: 'Thất bại' },
    /** A failure with its reason: `Thất bại (quá 2 giờ)`. */
    statusWithReason: '{status} ({reason})',
    reason: { timeout: 'quá 2 giờ', reported: 'bot báo lỗi' },
    prLabel: 'PR #{number}',
    none: '—',
    empty: {
      title: 'Chưa có lần chạy nào',
      description: 'Lần chạy đầu tiên của bot sẽ hiện ở đây.',
    },
    error: {
      title: 'Không đọc được nhật ký chạy',
      description: 'Các điều khiển vẫn dùng được. Bạn tải lại trang để thử lại nhé.',
    },
  },
  /** Today's plan run left eligible users out (§2.4, §6.2): on `/admin` and `/admin/bot`. */
  deferred: {
    warning:
      '{count} người dùng AI không được xử lý hôm nay — tăng giới hạn hoặc giảm số người dùng AI.',
    action: 'Mở Bot AI',
  },
  /** The "Bot AI" card of `/admin`'s system section: the latest run's status. */
  overview: {
    label: 'Bot AI',
    lastRun: 'Lần chạy gần nhất: {day}',
    never: 'Chưa chạy',
    neverHint: 'Bot chưa chạy lần nào.',
    /** `admin_bot_runs` failed: unknown, never "Chưa chạy". */
    unknown: 'Không đọc được',
    unknownHint: 'Không đọc được nhật ký chạy của bot. Bạn tải lại trang để thử lại nhé.',
  },
} as const
