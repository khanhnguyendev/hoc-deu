/**
 * `/` (§2.4): the signed-out landing page (DESIGN_SYSTEM §15). Calm, direct voice (§11): no hype,
 * no invented numbers. The example plan is fixed sample data, labelled "Ví dụ" wherever it shows.
 * `{track}` and the like are not used here: every string is final.
 */
export const landing = {
  /** The one site description (page `description` and Open Graph card, `app/layout.tsx`). */
  description:
    'Học Đều chia lộ trình DSA và tiếng Anh cho IT thành kế hoạch cho hôm nay, vừa với số phút bạn có.',
  signIn: 'Đăng nhập',
  /** `?account=deleted` (§4.6): shown after a successful account deletion. */
  deletedBanner: 'Tài khoản của bạn đã được xoá.',
  headline: { first: 'Mỗi ngày một chút.', second: 'Đều là đủ.' },
  lead: 'Học Đều chia lộ trình DSA và tiếng Anh cho IT thành kế hoạch cho hôm nay, vừa với số phút bạn có. Lộ trình chỉ đi tiếp vào những ngày bạn học.',
  cta: 'Bắt đầu học',
  ctaNote: 'Tài khoản mới cần quản trị viên duyệt. Bạn đăng nhập bằng Google hoặc GitHub.',
  /** The example day beside the headline: plain text, nothing in it is interactive. */
  preview: {
    caption: 'Ví dụ: một ngày 45 phút',
    date: 'Thứ Tư, 16/09',
    totalMinutes: 45,
    minutesUnit: 'phút',
    dsa: 'DSA',
    english: 'Tiếng Anh',
    itemLabels: { lesson: 'Bài học', problem: 'Bài tập', review: 'Đến hạn', cards: 'Thẻ' },
    blocks: {
      newLesson: { kind: 'Bài mới', minutes: 20 },
      review: { kind: 'Ôn tập', minutes: 10 },
      cards: { kind: 'Thẻ mới', minutes: 15 },
    },
    cardsCount: '8 thẻ',
    cardsDeck: 'Explaining code',
    heatLabel: '7 ngày gần nhất',
    /** Read by screen readers in place of the decorative cells. */
    heatSummary:
      'Bảy ngày gần nhất: thứ Hai và thứ Ba đã học, hôm nay đã xong 45 phút, các ngày sau chưa tới.',
  },
  day: {
    title: 'Một ngày học',
    steps: [
      {
        title: 'Mở kế hoạch hôm nay',
        body: 'Kế hoạch vừa với số phút bạn đã đặt cho ngày hôm nay.',
      },
      {
        title: 'Học',
        body: 'Bài học, bài tập DSA với lời giải Python, Java, Go, và thẻ tiếng Anh cho IT.',
      },
      {
        title: 'Check-in',
        body: 'Ghi số phút và trạng thái: xong, một phần hoặc bỏ qua. Lộ trình chỉ đi tiếp vào những ngày bạn học, và bài ôn quay lại khi đến hạn.',
      },
    ],
  },
  tracks: {
    title: 'Hai lộ trình chạy song song',
    dsa: {
      title: 'Cấu trúc dữ liệu & Giải thuật',
      badge: 'DSA',
      facts: [
        'Bài tập chọn từ NeetCode 150, xếp theo pattern',
        'Lộ trình 8 hoặc 10 tuần, tuỳ số phút mỗi ngày',
        'Lời giải bằng Python, Java và Go',
        'Bài học cho các pattern chính',
      ],
    },
    english: {
      title: 'Tiếng Anh cho môi trường IT',
      badge: 'Tiếng Anh',
      facts: [
        'Lộ trình 10 tuần, mỗi tuần một chủ đề như stand-up, ticket, code review',
        'Thẻ từ vựng với ví dụ và cách phát âm',
        'Ôn lặp lại ngắt quãng',
        'Chạy song song với DSA',
      ],
    },
  },
  missed: {
    label: 'Ví dụ',
    title: 'Bỏ lỡ một ngày chỉ mất một ngày',
    body: 'Kế hoạch được tính lại từ những gì bạn thực sự đã làm. Ngày trống vẫn là ngày trống, không phải nợ: lộ trình chờ bạn và đi tiếp vào ngày học kế tiếp.',
    caption: 'Sáu tuần học, có hai ngày trống',
    summary: 'Ví dụ sáu tuần học: phần lớn các ngày có học, hai ngày trống.',
  },
  close: {
    title: 'Bắt đầu với kế hoạch của hôm nay',
    openSource: 'Mã nguồn mở trên GitHub',
    githubHref: 'https://github.com/khanhnguyendev/hoc-deu',
    ai: 'AI cá nhân hoá kế hoạch: sắp có',
  },
} as const
