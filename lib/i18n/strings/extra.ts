import { checkIn } from './check-in'

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
    /**
     * §5.5: the plan's snapshot caps the track at 0 new items for the whole plan. The throttle
     * banner above says why, with the plan-time count and the "Ôn tập" link, so the card says
     * only this (UI I-5: the throttle is shown once).
     */
    newPaused: 'Hôm nay tạm dừng bài mới.',
    /** The plan changed since the page was rendered (paused, rebuilt, or now throttled): the
     *  one "page refreshed" message (UI I-3). */
    stale: checkIn.errors.stale,
    invalid: 'Không thể học thêm lúc này. Bạn tải lại trang rồi thử lại.',
  },
  /** The track page (§2.4; Part B-M3 decision 25): the learner's progress on the track. */
  progress: {
    title: 'Tiến độ của bạn',
    /** The week and the ring's name are `vi.trackProgress` (TrackProgressCard, m-1). */
    core: '{introduced}/{total} bài chính đã học',
  },
  /** The track's items with status Weak (§5.7): "mục", cards among them (m-6). */
  weak: {
    title: 'Mục yếu',
    description: 'Những mục bạn chưa nắm chắc — chúng được ưu tiên khi ôn tập.',
    empty: 'Chưa có mục yếu nào trong lộ trình này.',
  },
  /** "Bắt đầu lại" (§5.9 "Removing a track"; Part B-M2 decision 18): `track.reset`. */
  reset: {
    action: 'Bắt đầu lại',
    title: 'Xoá tiến độ của lộ trình này?',
    description: 'Lịch sử học và chuỗi ngày vẫn được giữ.',
    confirm: 'Bắt đầu lại',
    done: 'Đã bắt đầu lại lộ trình {title}.',
    /** Refused because the track changed (removed in another tab): `resetTrack` has already
     *  re-rendered the track page — never "tải lại trang" (re-review M2). */
    stale: 'Lộ trình này vừa thay đổi. Trang đã được làm mới.',
  },
} as const
