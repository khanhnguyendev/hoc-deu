/** Check-in: the write path's messages and the sheet (tasks 5.2a, 5.2b; Part B-M5 decision 3). */
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
    /** Decision 13: the plan named is no longer the one `/today` shows. */
    stale: 'Kế hoạch đã thay đổi — tải lại trang.',
    invalid: 'Dữ liệu gửi lên không hợp lệ. Bạn tải lại trang nhé.',
    unknownItem: 'Không tìm thấy mục học này.',
  },
} as const
