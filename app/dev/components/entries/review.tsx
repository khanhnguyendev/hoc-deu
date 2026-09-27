import { ErrorState } from '@/components/patterns/error-state'
import { LinkRow } from '@/components/patterns/link-row'
import { LoadingState } from '@/components/patterns/loading-state'
import { StatusPill } from '@/components/patterns/status-pill'
import { cardItem, REQUEST_ID } from '@/features/items/fixtures'
import type { RecordOutcome } from '@/features/items/outcome'
import { ReviewFilters, type ReviewFiltersTrack } from '@/features/review/components/review-filters'
import { ReviewList } from '@/features/review/components/review-list'
import { ReviewSession } from '@/features/review/components/review-session'
import { ReviewView } from '@/features/review/components/review-view'
import type { ReviewPage } from '@/features/review/queries'
import type { ReviewItemSlot } from '@/features/review/slots'
import { vi } from '@/lib/i18n/vi'
import type { Entry } from '../types'

/** `/dev/components` entries of features/review (task 5.3) — Part B-M5 decision 3: only that task edits this file. */

const WAIT_MS = 600

/** A stand-in `recordOutcome` that saves after a moment (nothing is sent anywhere). */
const saves: RecordOutcome = () =>
  new Promise((resolve) =>
    setTimeout(
      () => resolve({ ok: true, message: vi.checkIn.outcome.saved, autoCheckedIn: [] }),
      WAIT_MS,
    ),
  )

const DEMO_TRACKS: readonly ReviewFiltersTrack[] = [
  { id: 'dsa', title: 'Cấu trúc dữ liệu & Giải thuật', count: 2 },
  { id: 'english', title: 'Tiếng Anh cho môi trường IT', count: 1 },
]

/**
 * The registry's rows are plain LinkRows here (the page builds the real ones through
 * `renderItemRow`, `reviewRows`) — the "Yếu" pill lives inside the row's own link, as the real
 * rows do (task 5.3 review, finding M5).
 */
const row = (itemId: string, title: string, meta: string[], weak = false): ReviewItemSlot => ({
  itemId,
  row: (
    <LinkRow
      href={`/t/dsa/items/${itemId}`}
      title={title}
      meta={meta}
      trailing={weak ? <StatusPill status="weak" /> : undefined}
    />
  ),
})

const DEMO_ROWS: ReviewItemSlot[] = [
  row('lc-0001', 'Two Sum', ['#1', 'Dễ', 'Arrays & Hashing'], true),
  row('lc-0015', '3Sum', ['#15', 'Trung bình', 'Two Pointers']),
]

const DEMO_CARDS: ReviewPage['cards'] = [
  { itemId: 'english:w01-blocker', sides: cardItem().content },
]

const DEMO_ENTRIES: ReviewPage['entries'] = [
  {
    itemId: 'english:w01-blocker',
    trackId: 'english',
    mode: 'review',
    minutes: 0.5,
    weak: true,
    overdueDays: 0,
    href: '/t/english/items/w01-blocker?mode=review',
  },
  {
    itemId: 'dsa:lc-0001',
    trackId: 'dsa',
    mode: 'redo',
    minutes: 12,
    weak: true,
    overdueDays: 2,
    href: '/t/dsa/items/lc-0001?mode=redo',
  },
  {
    itemId: 'dsa:lc-0015',
    trackId: 'dsa',
    mode: 'recall',
    minutes: 5,
    weak: false,
    overdueDays: 0,
    href: '/t/dsa/items/lc-0015?mode=recall',
  },
]

const DEMO_PAGE: ReviewPage = {
  entries: DEMO_ENTRIES,
  cards: DEMO_CARDS,
  tracks: DEMO_TRACKS,
  track: null,
  requestId: REQUEST_ID,
}

const DEMO_EMPTY_PAGE: ReviewPage = {
  entries: [],
  cards: [],
  tracks: DEMO_TRACKS.map((track) => ({ ...track, count: 0 })),
  track: null,
  requestId: REQUEST_ID,
}

const DEMO_FILTERED_EMPTY_PAGE: ReviewPage = {
  entries: [],
  cards: [],
  tracks: [
    { id: 'dsa', title: 'Cấu trúc dữ liệu & Giải thuật', count: 0 },
    { id: 'english', title: 'Tiếng Anh cho môi trường IT', count: 3 },
  ],
  track: 'dsa',
  requestId: REQUEST_ID,
}

export const REVIEW_ENTRIES: Entry[] = [
  {
    name: 'ReviewFilters',
    layer: 'features',
    file: 'features/review/components/review-filters.tsx',
    demos: [
      {
        title: '"Tất cả" đang chọn',
        render: () => <ReviewFilters tracks={DEMO_TRACKS} active={null} />,
      },
      {
        title: 'Một lộ trình đang chọn',
        render: () => <ReviewFilters tracks={DEMO_TRACKS} active="dsa" />,
      },
    ],
  },
  {
    name: 'ReviewList',
    layer: 'features',
    file: 'features/review/components/review-list.tsx',
    demos: [
      { title: 'Có bài cần ôn, một bài Yếu', render: () => <ReviewList items={DEMO_ROWS} /> },
      { title: 'Trống', render: () => <ReviewList items={[]} /> },
    ],
  },
  {
    name: 'ReviewSession',
    layer: 'features',
    file: 'features/review/components/review-session.tsx',
    demos: [
      {
        title: 'Có bài cần ôn: thẻ và danh sách',
        render: () => <ReviewSession page={DEMO_PAGE} rows={DEMO_ROWS} record={saves} />,
      },
      {
        title: 'Trống (RF-4): không có mục nào cần ôn hôm nay',
        render: () => <ReviewSession page={DEMO_EMPTY_PAGE} rows={[]} record={saves} />,
      },
      {
        title: 'Một lộ trình không có bài (lộ trình khác vẫn còn, task 5.3 review M3)',
        render: () => <ReviewSession page={DEMO_FILTERED_EMPTY_PAGE} rows={[]} record={saves} />,
      },
    ],
  },
  {
    name: 'ReviewView',
    layer: 'features',
    file: 'features/review/components/review-view.tsx',
    demos: [
      {
        title: 'Có bài cần ôn: thẻ và danh sách',
        render: () => <ReviewView page={DEMO_PAGE} rows={DEMO_ROWS} record={saves} />,
      },
      {
        title: 'Trống (RF-4): không có mục nào cần ôn hôm nay',
        render: () => <ReviewView page={DEMO_EMPTY_PAGE} rows={[]} record={saves} />,
      },
      {
        title: 'Đang tải (app/(app)/review/loading.tsx)',
        render: () => <LoadingState variant="page" />,
      },
      {
        title: 'Lỗi (app/(app)/review/error.tsx)',
        render: () => <ErrorState titleAs="h1" onRetry={() => {}} />,
      },
    ],
  },
]
