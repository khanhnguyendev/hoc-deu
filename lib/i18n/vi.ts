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
} as const
