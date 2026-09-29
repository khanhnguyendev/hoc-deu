/**
 * Rate-limit messages (§2.3; Part B-M6 decision 3, decision 22): only task 6.1 edits this file,
 * in its wave. `{count}` in `admin.failOpen.value` is a formatted number.
 */
export const rateLimit = {
  /** Over the bot API, OAuth callback, account-deletion or admin-action limit. */
  tooMany: 'Bạn thao tác quá nhanh. Hãy thử lại sau ít phút.',
  /** `/admin` (§8.4 item 5, route map §2.4): the memory-mode warning and the fail-open card. */
  admin: {
    /** Shown in production only, while no Upstash is configured (`rateLimitMode()` is `memory`). */
    memoryWarning: 'Giới hạn tần suất đang chạy trong bộ nhớ (chưa cấu hình Upstash)',
    memoryWarningAction: 'Xem biến môi trường',
    /** The system card: the sum of `ratelimit.fail_open` rows over the last 7 days. */
    failOpen: {
      label: 'Giới hạn tần suất mở khi lỗi',
      value: '{count} lần',
      hint: 'Trong 7 ngày qua — Upstash lỗi hoặc quá thời gian, bộ nhớ quyết định thay.',
      /** The warning shown above 0 (decision 22). */
      warning: 'Giới hạn tần suất đã mở khi lỗi {count} lần trong 7 ngày qua.',
    },
  },
} as const
