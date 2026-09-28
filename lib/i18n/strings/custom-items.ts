/** Custom items and "Mục riêng" (Part B-M6 decision 3): only task 6.6a edits this file, in its wave. */
export const customItems = {
  /** The track page's tabs (§2.4): the roadmap, and the learner's custom items. */
  tabs: { label: 'Nội dung lộ trình', roadmap: 'Lộ trình', custom: 'Mục riêng' },
  title: 'Mục riêng',
  description:
    'Các mục bot AI tạo riêng cho bạn. Mở một mục để học; mục đã ẩn không còn xuất hiện trong kế hoạch.',
  /** A hidden item's badge in the list. */
  hidden: 'Đã ẩn',
  /** A custom prompt's tag badge (its tag is `custom`, decision 17a). */
  promptTag: 'Mục riêng',
  /** The item page's label for the learner's own custom item. */
  ownLabel: 'Mục riêng của bạn',
  hide: {
    action: 'Ẩn',
    /** The button's accessible name: its visible text first (label in name). */
    actionLabel: 'Ẩn {title}',
    title: 'Ẩn mục này?',
    description: 'Mục này sẽ không xuất hiện trong kế hoạch từ ngày mai.',
    confirm: 'Ẩn',
    done: 'Đã ẩn mục này.',
    already: 'Mục này đã được ẩn trước đó.',
    notFound: 'Không tìm thấy mục này.',
  },
  error: {
    title: 'Không đọc được mục riêng',
    description: 'Lộ trình vẫn dùng được. Tải lại trang để thử lại.',
  },
} as const
