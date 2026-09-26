/**
 * "Học thêm", off-plan study, track progress and "Bắt đầu lại" (task 5.4; Part B-M5 decision 3).
 * `{n}`, `{week}`, `{weeks}`, `{introduced}` and `{total}` are formatted numbers, `{title}` a track
 * title.
 */
export const extra = {
  /** "Học thêm" on `/today` (decision 20; §5.9 "Catching up / studying more"). */
  add: {
    title: 'Học thêm',
    description: 'Thêm bài mới tiếp theo của lộ trình vào kế hoạch.',
    action: 'Học thêm',
    added: 'Đã thêm bài mới vào kế hoạch.',
    nothingToAdd: 'Bạn đã học hết bài mới của lộ trình này.',
    /** §5.5: the plan's snapshot caps the track at 0 new items. */
    throttled: 'Đang có {n} thẻ cần ôn — hãy ôn trước khi học thêm.',
    review: 'Ôn tập',
    /** The plan changed since the page was rendered (paused, rebuilt, or now throttled). */
    stale: 'Kế hoạch vừa thay đổi. Trang đã được làm mới.',
    invalid: 'Không thể học thêm lúc này. Bạn tải lại trang rồi thử lại.',
  },
  /** The track page (§2.4; Part B-M3 decision 25): the learner's progress on the track. */
  progress: {
    title: 'Tiến độ của bạn',
    week: 'Tuần {week}/{weeks}',
    core: '{introduced}/{total} bài chính đã học',
    ring: 'Tiến độ {title}',
  },
  /** The track's items with status Weak (§5.7). */
  weak: {
    title: 'Bài yếu',
    description: 'Những bài bạn chưa nắm chắc — chúng được ưu tiên khi ôn tập.',
    empty: 'Chưa có bài yếu nào trong lộ trình này.',
  },
  /** "Bắt đầu lại" (§5.9 "Removing a track"; Part B-M2 decision 18): `track.reset`. */
  reset: {
    action: 'Bắt đầu lại',
    title: 'Xoá tiến độ của lộ trình này?',
    description: 'Lịch sử học và chuỗi ngày vẫn được giữ.',
    confirm: 'Bắt đầu lại',
    done: 'Đã bắt đầu lại lộ trình {title}.',
  },
} as const
