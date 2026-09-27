/**
 * Check-in: the write path's messages and the check-in UI (tasks 5.2a, 5.2b; Part B-M5 decision
 * 3). `{kind}` is a block's kind label ("Bài mới"), `{track}` a track title, `{minutes}` a
 * formatted duration, `{n}` / `{max}` formatted numbers.
 */
export const checkIn = {
  /** `checkInBlock`'s answer, per status (5.2a). */
  checkedIn: {
    done: 'Đã check-in: xong khối học.',
    partial: 'Đã check-in: xong một phần khối học.',
    skipped: 'Đã check-in: bỏ qua khối học.',
  },
  /** `recordOutcome`'s answers (5.2a). */
  outcome: {
    saved: 'Đã lưu kết quả.',
    /** The result finished a block, which the server then checked in (§5.5). */
    savedAndCheckedIn: 'Đã lưu kết quả. Khối học đã được tự động check-in.',
    /** The result is saved, but its auto check-in failed: the learner can still tap check-in. */
    savedAutoCheckInFailed: 'Đã lưu kết quả; chưa tự check-in được.',
  },
  errors: {
    /** RF-3: more than 280 graphemes, or more than the event payload holds — one message. */
    noteTooLong: 'Ghi chú quá dài — tối đa 280 ký tự.',
    /**
     * Decision 13: the plan named is no longer the one `/today` shows. The one "page refreshed"
     * message (UI I-3): every action that answers it has already revalidated `/today`, so the page
     * the learner reads it on is the new one ("Học thêm" and "Học tiếp hôm nay" reuse it).
     */
    stale: 'Kế hoạch vừa thay đổi. Trang đã được làm mới.',
    invalid: 'Dữ liệu gửi lên không hợp lệ. Bạn tải lại trang nhé.',
    unknownItem: 'Không tìm thấy mục học này.',
  },
  /** Which block a button or link acts on, for screen readers (5.2b): "Bài mới · {track}". */
  blockLabel: '{kind} · {track}',
  /** The one-tap button (DESIGN_SYSTEM §9, §11: buttons are verbs). */
  oneTap: 'Check-in',
  /** CheckInStatus: the checked-in row (5.2b, DESIGN_SYSTEM §9). */
  status: {
    checkedIn: 'Đã check-in',
    auto: 'tự động',
    edit: 'Sửa',
    /** M-6: the paused view, next to a skipped block — its results never re-check it (§5.5). */
    skippedHint: 'Đã bỏ qua — bấm Sửa khi bạn làm xong',
    /** The owner's line (ruling M-6 a, ADR-0016). */
    skippedRule: 'Sửa sau giờ bắt đầu ngày sẽ tính cho hôm nay; ngày trước vẫn chưa hoàn thành.',
  },
  /** CheckInSheet (5.2b, DESIGN_SYSTEM §9): `/today?block=<id>`. */
  sheet: {
    title: 'Check-in: {kind}',
    description: '{track} · dự kiến {minutes}',
    status: 'Trạng thái',
    minutes: 'Số phút đã học',
    minutesHelper: 'Từ 0 đến 600 phút.',
    minutesInvalid: 'Nhập số phút từ 0 đến 600.',
    fewer: 'Bớt 5 phút',
    more: 'Thêm 5 phút',
    note: 'Ghi chú (không bắt buộc)',
    /** The live grapheme counter (RF-3). */
    noteCount: '{n}/{max}',
    submit: 'Lưu check-in',
  },
} as const
