/**
 * "Chia sẻ ghi chú với bot AI" (task 6.7b, §4.6, §6.3): shown in /settings only while the
 * learner's `ai_personalization` is on. Part B-M6 decision 3: only task 6.7b edits this file.
 */
export const notesSharing = {
  title: 'Chia sẻ ghi chú với bot AI',
  description: 'Bot AI và người vận hành bot có thể xem ghi chú bạn chia sẻ.',
  on: 'Đã bật chia sẻ ghi chú với bot AI.',
  off: 'Đã tắt chia sẻ ghi chú với bot AI.',
  errors: {
    /** The database's `ai_personalization_off` (§4.5): the AI flag turned off since the page
     *  was rendered (or was never on) — the switch would not even show without a stale page. */
    aiOff: 'Tính năng này chỉ dùng được khi tài khoản bật cá nhân hoá AI.',
  },
} as const
