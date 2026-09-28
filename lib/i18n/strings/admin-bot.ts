/**
 * `/admin/bot` and the AI flag in `/admin/users` (§2.4, §6.2, §6.3; ADR-0026; Part B-M6 decision
 * 3): only tasks 6.3 and 6.4a edit this file, in their waves. `{time}` is a clock time, `{day}` a
 * formatted day, `{max}` a formatted number, `{name}` a display name (inserted literally).
 */
export const adminBot = {
  /** The sidebar entry and the page title. */
  nav: 'Bot AI',
  description: 'Công tắc của bot, chế độ chạy thử, giới hạn mỗi lần chạy và token truy cập.',
  /** `BOT_API_ENABLED` is not `true`: the switch below cannot turn the bot on by itself. */
  apiDisabled:
    'Chưa bật API bot: biến môi trường BOT_API_ENABLED đang tắt, nên mọi yêu cầu của bot đều bị từ chối. Công tắc này chỉ đổi được khi triển khai lại.',
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
} as const
