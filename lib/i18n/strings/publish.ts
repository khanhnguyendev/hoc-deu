/**
 * Publish requests (§2.4 `/admin/content`, §3.5, §6.6; ADR-0024, 0025, 0040; Part B-M6 decisions 3
 * and 20): only task 6.7a edits this file, in its wave. `{title}` is an item's title (inserted
 * literally), `{number}` a pull request number, `{time}` a formatted date and time.
 */
export const publish = {
  /** "Xuất bản" on a draft item or draft note of the drafts list. */
  button: 'Xuất bản',
  /** The button's accessible name: which draft it publishes. */
  buttonFor: 'Xuất bản {title}',
  /** The publish checklist (§6.6): three boxes, all required. */
  dialog: {
    title: 'Xuất bản {title}?',
    description:
      'Đánh dấu đủ ba mục bên dưới. Yêu cầu được ghi lại; lần chạy xuất bản tiếp theo của bot mở pull request đổi trạng thái sang active.',
    checklist: 'Danh sách kiểm tra trước khi xuất bản',
    /** A problem or its note: the three checks of §6.6. */
    problem: [
      'Các ví dụ trong tests.yaml khớp với ví dụ trên LeetCode.',
      'Phần giải thích và độ phức tạp đều đúng.',
      'Câu song ngữ đọc tự nhiên.',
    ],
    /** Any other draft item (a lesson, a card, an exercise, a prompt): the same checks in its terms. */
    item: [
      'Ví dụ và đáp án đều đúng, không chép đề bài LeetCode.',
      'Phần giải thích đúng và đủ ý.',
      'Phần tiếng Anh và câu song ngữ đọc tự nhiên.',
    ],
    incomplete: 'Đánh dấu đủ ba mục để xuất bản.',
  },
  /** A pending request: the state, its PR once a publish run includes it, and "Huỷ". */
  pending: 'Đang chờ xuất bản',
  prLabel: 'PR #{number}',
  cancel: 'Huỷ',
  cancelFor: 'Huỷ yêu cầu xuất bản {title}',
  results: {
    requested: 'Đã ghi yêu cầu xuất bản.',
    cancelled: 'Đã huỷ yêu cầu xuất bản.',
  },
  errors: {
    /** The target is not a draft item or draft note of the deployed catalog. */
    notDraft: 'Chỉ xuất bản được một mục hoặc ghi chú đang là bản nháp.',
    /** The request is no longer pending (merged, or cancelled by another admin). */
    changed: 'Yêu cầu này đã thay đổi. Trang đã được cập nhật.',
    failed: 'Không lưu được yêu cầu. Bạn thử lại nhé.',
  },
  /** ADR-0040: a bot-written note's badge until an admin publishes it with the checklist (§3.5). */
  badge: {
    testedByBot: 'Đã kiểm thử (test do bot viết)',
  },
  /** The "Yêu cầu xuất bản" section of `/admin/content`. */
  requests: {
    title: 'Yêu cầu xuất bản',
    description:
      'Các yêu cầu đang chờ và gần đây, mới nhất trước. Lần chạy xuất bản của bot nhận các yêu cầu đang chờ chưa có pull request.',
    /** The table's accessible name (its scroll region). */
    label: 'Các yêu cầu xuất bản',
    columns: {
      target: 'Mục',
      status: 'Trạng thái',
      pr: 'Pull request',
      requestedAt: 'Yêu cầu lúc',
    },
    status: { pending: 'Đang chờ', merged: 'Đã xuất bản', cancelled: 'Đã huỷ' },
    /** When it was requested (Asia/Ho_Chi_Minh). */
    at: '{time}, {day}',
    none: '—',
    empty: {
      title: 'Chưa có yêu cầu xuất bản nào',
      description: 'Bấm "Xuất bản" ở một bản nháp để tạo yêu cầu.',
    },
    error: {
      title: 'Không đọc được yêu cầu xuất bản',
      description: 'Danh sách tạm thời không tải được. Bạn tải lại trang sau nhé.',
    },
  },
} as const
