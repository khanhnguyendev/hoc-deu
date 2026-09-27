/**
 * `/admin` and `/admin/content` (task 5.6; Part B-M5 decision 3). `{size}`, `{when}`, `{time}`,
 * `{track}`, `{variant}`, `{weeks}`, `{count}` and `{week}` are filled with `fill`
 * (`lib/i18n/format.ts`). Item types and MB stay English (technical terms).
 */
export const adminOverview = {
  description: 'Cảnh báo của hệ thống, số liệu tổng hợp và lối tắt đến các trang quản trị.',
  /** AdminWarnings (§8.4 item 5, decision 25): icon + one sentence + one action each. */
  warnings: {
    title: 'Cảnh báo',
    none: 'Không có cảnh báo nào.',
    dbIncremental: 'Cơ sở dữ liệu đã dùng {size} — chuyển sao lưu sang chuỗi gia tăng.',
    dbWarn: 'Cơ sở dữ liệu đã dùng {size} — đến lúc bật nén sự kiện cũ (ADR-0031).',
    dbCritical: 'Cơ sở dữ liệu đã dùng {size}, sát giới hạn 500 MB — cần nén sự kiện ngay.',
    backupStale:
      'Không có bản sao lưu thành công nào được xác nhận trong 36 giờ qua (gần nhất: {when}).',
    restoreStale:
      'Không có lần kiểm tra khôi phục thành công nào được xác nhận trong 8 ngày qua (gần nhất: {when}).',
    /** The cron has run (ADR-0034), yet no successful run was ever read. */
    backupNever: 'Chưa có lần sao lưu thành công nào, dù cron bảo trì đã chạy.',
    restoreNever: 'Chưa có lần kiểm tra khôi phục thành công nào, dù cron bảo trì đã chạy.',
    /** I2: `cron.last_run_at` itself unrefreshed for 36 hours — never shown together with a
     * backup/restore-test staleness warning caused only by the same dead cron. */
    cronStale: 'Cron bảo trì chưa chạy lại kể từ {when}.',
    coverage:
      '{track} ({variant}): tuần {weeks} thiếu bài học hoặc ghi chú, mà học viên sẽ học tới trong 14 ngày.',
    actions: {
      backupsRunbook: 'Xem hướng dẫn sao lưu',
      compaction: 'Xem ADR-0031',
      backupRuns: 'Xem các lần sao lưu',
      restoreRuns: 'Xem các lần kiểm tra',
      maintenanceCron: 'Xem ADR-0034',
      content: 'Xem độ phủ nội dung',
    },
  },
  counts: {
    title: 'Tài khoản và hoạt động',
    pending: 'Chờ duyệt',
    active: 'Đang hoạt động',
    suspended: 'Tạm khoá',
    rejected: 'Bị từ chối',
    learnersCompleted: 'Học viên hoàn thành ngày học',
    plansCreated: 'Kế hoạch được tạo',
    last7Days: 'Trong 7 ngày qua',
  },
  /** The latest `ops_metrics` rows, written once a day by the maintenance cron (ADR-0034). */
  system: {
    title: 'Hệ thống',
    dbSize: 'Dung lượng cơ sở dữ liệu',
    dbSizeHint: 'Giới hạn của gói miễn phí: 500 MB',
    backup: 'Sao lưu gần nhất',
    restoreTest: 'Kiểm tra khôi phục gần nhất',
    cron: 'Cron bảo trì chạy gần nhất',
    at: 'Lúc {time} (giờ Việt Nam)',
    /** `{when}` in a warning: `05:17, 27 tháng 9, 2026`. */
    when: '{time}, {day}',
    noData: 'chưa có dữ liệu',
    /** Before the first cron run only. */
    noDataHint: 'Có sau lần chạy đầu tiên của cron bảo trì.',
    /** The cron has run, but no successful backup / restore test was read. */
    noSuccessHint: 'Cron bảo trì đã chạy nhưng chưa thấy lần chạy thành công nào.',
    /** A DB size the cron has not measured for 36 hours. */
    staleHint: 'Không có số liệu mới trong 36 giờ qua (đo lúc {when}).',
  },
  links: {
    title: 'Trang quản trị',
    usersMeta: '{count} tài khoản chờ duyệt',
    contentOk: 'Không có tuần nào thiếu nội dung',
    contentRed: '{count} tuần cần bổ sung nội dung',
  },
  /** `/admin/content` (§2.4). */
  content: {
    description: 'Số mục, kiểm chứng lời giải, độ phủ từng tuần và các bản nháp của mỗi lộ trình.',
    trackStatus: { active: 'Đang dùng', draft: 'Bản nháp', retired: 'Đã ngừng' },
    stats: {
      title: 'Số mục',
      label: 'Số mục của {track} theo loại và trạng thái',
      type: 'Loại',
      active: 'Đang dùng',
      draft: 'Bản nháp',
      retired: 'Đã ngừng',
      types: {
        problem: 'Problem',
        lesson: 'Lesson',
        flashcard: 'Flashcard',
        exercise: 'Exercise',
        prompt: 'Prompt',
      },
      empty: 'Lộ trình này chưa có mục nào.',
      verification:
        'Kiểm chứng lời giải: {tested} đã kiểm thử · {compileOnly} chỉ biên dịch · {noNote} chưa có ghi chú',
    },
    coverage: {
      title: 'Độ phủ theo tuần — {variant}',
      label: 'Độ phủ theo tuần của {track}, {variant}',
      week: 'Tuần',
      learners: 'Học viên',
      lessons: 'Bài học',
      notes: 'Ghi chú (bài chính)',
      cards: 'Thẻ (core + extended)',
      exercises: 'Exercise',
      prompts: 'Prompt',
      state: 'Tình trạng',
      missing: '(thiếu)',
      noTopics: '—',
      red: 'Cần bổ sung',
      covered: 'Đủ',
      gap: 'Còn thiếu',
      horizon:
        'Học viên có kế hoạch trong 14 ngày qua đang ở tới tuần {week}: cảnh báo tính đến tuần {horizon}.',
      noLearners: 'Chưa học viên nào có kế hoạch trong 14 ngày qua: chưa có tuần nào cần cảnh báo.',
      missingRoadmap: 'Chưa có tệp lộ trình cho biến thể này.',
    },
    drafts: {
      title: 'Bản nháp',
      description:
        'v1.0: xuất bản bằng một thay đổi `status` trong `content/**` (nút "Xuất bản" có từ v1.1).',
      tracks: 'Lộ trình nháp',
      items: 'Mục nháp',
      notes: 'Ghi chú nháp',
      note: 'Ghi chú',
      empty: 'Không có bản nháp nào.',
    },
  },
} as const
