import type * as React from 'react'
import { LinkRow } from '@/components/patterns/link-row'
import { StatusPill } from '@/components/patterns/status-pill'
import type { OutcomeResult } from '@/features/checkin/actions'
import type { CardSessionCard } from '@/features/items/outcome'
import { ResetTrackButton } from '@/features/roadmap/components/reset-track-button'
import { TrackOverview } from '@/features/roadmap/components/track-overview'
import { TrackProgress } from '@/features/roadmap/components/track-progress'
import { WeakItems } from '@/features/roadmap/components/weak-items'
import type { ExtraResult } from '@/features/today/actions'
import { CardBlock } from '@/features/today/components/card-block'
import { ExtraButton } from '@/features/today/components/extra-button'
import type { BlockItemSlot } from '@/features/today/slots'
import type { ExtraView } from '@/features/today/view-model'
import { withTitle } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { Entry } from '../types'

/**
 * `/dev/components` entries of "Học thêm", the card blocks of `/today`, track progress, Weak items
 * and "Bắt đầu lại" (task 5.4) — Part B-M5 decision 3: only that task edits this file. The actions
 * are demos (nothing is saved); the rows are plain LinkRows standing in for the registry's.
 */

const DSA = 'Cấu trúc dữ liệu & Giải thuật'
const ENGLISH = 'Tiếng Anh cho môi trường IT'
const REQUEST_ID = 'c0ffee00-1234-4abc-8def-0123456789ab'

const demoAddExtra = async (): Promise<ExtraResult> => ({ ok: true, message: vi.extra.add.added })
const demoNothingToAdd = async (): Promise<ExtraResult> => ({
  ok: false,
  message: vi.extra.add.nothingToAdd,
})
const demoRecord = async (): Promise<OutcomeResult> => ({
  ok: true,
  message: vi.checkIn.outcome.saved,
  autoCheckedIn: [],
})
const demoRecordFailure = async (): Promise<OutcomeResult> => ({
  ok: false,
  message: vi.errors.saveFailed,
  autoCheckedIn: [],
})
const demoReset = async () => ({
  ok: true,
  message: withTitle(vi.extra.reset.done, DSA),
})
const demoResetStale = async () => ({ ok: false, message: vi.errors.invalidTransition })

const DSA_EXTRA: ExtraView = {
  trackId: 'dsa',
  trackTitle: DSA,
  accent: 'track-1',
  newPaused: false,
}
const ENGLISH_THROTTLED: ExtraView = {
  trackId: 'english',
  trackTitle: ENGLISH,
  accent: 'track-2',
  newPaused: true,
}

const CARDS: CardSessionCard[] = [
  {
    itemId: 'english:w01-blocker',
    blockId: '2026-09-28:english:new:1',
    sides: {
      front: 'blocker',
      back: 'vấn đề đang chặn, khiến bạn chưa làm tiếp được',
      hint: 'Hay đi với "have" hoặc "hit".',
      usage: { pos: 'noun', register: 'neutral', note: 'Thường nói "I have one blocker: …".' },
      example: "I have one blocker: I'm still waiting for access to the staging database.",
      pronunciation: '/ˈblɒk.ər/ · BLOCK-er',
      lang: { front: 'en', back: 'vi', hint: 'vi' },
    },
  },
  {
    itemId: 'english:w01-bandwidth',
    blockId: '2026-09-28:english:new:1',
    sides: {
      front: 'bandwidth',
      back: 'thời gian / sức còn trống để nhận thêm việc',
      lang: { front: 'en', back: 'vi', hint: 'vi' },
    },
  },
]

const row = (href: string, title: string, meta: string[], status: 'weak' | 'not-started') => (
  <LinkRow
    href={href}
    title={title}
    titleLang="en"
    meta={meta}
    trailing={<StatusPill status={status} />}
  />
)

const CARD_ROWS: BlockItemSlot[] = [
  {
    itemId: 'english:w01-blocker',
    row: row('/t/english/items/w01-blocker', 'blocker', ['Cốt lõi'], 'not-started'),
  },
  {
    itemId: 'english:w01-bandwidth',
    row: row('/t/english/items/w01-bandwidth', 'bandwidth', ['Cốt lõi'], 'not-started'),
  },
]

const WEAK_ROWS: React.ReactNode[] = [
  row('/t/dsa/items/lc-0001', 'Two Sum', ['#1', 'Easy', 'Arrays & Hashing'], 'weak'),
  row('/t/dsa/items/lc-0020', 'Valid Parentheses', ['#20', 'Easy', 'Stack'], 'weak'),
]

const narrow = (node: React.ReactNode) => (
  <div className="flex w-full max-w-xl flex-col gap-4">{node}</div>
)
/** The track page's accent context (TrackOverview's `data-accent`), for the ring's colour. */
const inDsa = (node: React.ReactNode) => (
  <div data-accent="track-1" className="flex w-full max-w-3xl flex-col gap-6">
    {node}
  </div>
)

const RESET = <ResetTrackButton action={demoReset} requestId={REQUEST_ID} trackId="dsa" />

export const EXTRA_ENTRIES: Entry[] = [
  {
    name: 'ExtraButton',
    layer: 'features',
    file: 'features/today/components/extra-button.tsx',
    demos: [
      {
        title: '"Học thêm" (thành công: thông báo cạnh nút và toast)',
        render: () =>
          narrow(<ExtraButton view={DSA_EXTRA} requestId={REQUEST_ID} action={demoAddExtra} />),
      },
      {
        title: 'Hết bài mới (thông báo cạnh nút, không toast)',
        render: () =>
          narrow(<ExtraButton view={DSA_EXTRA} requestId={REQUEST_ID} action={demoNothingToAdd} />),
      },
      {
        title:
          'Tạm dừng bài mới (giảm về 0, §5.5): một dòng, không có nút — lý do ở cảnh báo phía trên (UI I-5)',
        render: () =>
          narrow(
            <ExtraButton view={ENGLISH_THROTTLED} requestId={REQUEST_ID} action={demoAddExtra} />,
          ),
      },
    ],
  },
  {
    name: 'CardBlock',
    layer: 'features',
    file: 'features/today/components/card-block.tsx',
    demos: [
      {
        title: 'Khối chỉ có thẻ: chấm ngay trong khối (quyết định 19)',
        render: () =>
          narrow(
            <CardBlock
              cards={CARDS}
              items={CARD_ROWS}
              requestId={REQUEST_ID}
              record={demoRecord}
            />,
          ),
      },
      {
        title: 'Lỗi khi lưu: thẻ ở lại, "Thử lại"',
        render: () =>
          narrow(
            <CardBlock
              cards={CARDS.slice(0, 1)}
              items={CARD_ROWS}
              requestId={REQUEST_ID}
              record={demoRecordFailure}
            />,
          ),
      },
      {
        title: 'Mọi thẻ đã chấm trước khi mở trang: danh sách dòng',
        render: () =>
          narrow(
            <CardBlock cards={[]} items={CARD_ROWS} requestId={REQUEST_ID} record={demoRecord} />,
          ),
      },
    ],
  },
  {
    name: 'TrackProgress',
    layer: 'features',
    file: 'features/roadmap/components/track-progress.tsx',
    demos: [
      {
        title: 'Tuần 3/8, 20/64 bài chính, "Bắt đầu lại"',
        render: () =>
          inDsa(
            <TrackProgress
              title={DSA}
              progress={{ week: 3, weeks: 8, introduced: 20, total: 64 }}
              actions={RESET}
            />,
          ),
      },
      {
        title: 'Người học mới: 0 %',
        render: () =>
          inDsa(
            <TrackProgress
              title={DSA}
              progress={{ week: 1, weeks: 8, introduced: 0, total: 64 }}
            />,
          ),
      },
      {
        title: 'Phiên bản chưa có lộ trình: chỉ vòng tiến độ',
        render: () =>
          inDsa(
            <TrackProgress title={DSA} progress={{ week: 1, weeks: 0, introduced: 0, total: 0 }} />,
          ),
      },
    ],
  },
  {
    name: 'WeakItems',
    layer: 'features',
    file: 'features/roadmap/components/weak-items.tsx',
    demos: [
      { title: 'Các mục yếu', render: () => inDsa(<WeakItems rows={WEAK_ROWS} />) },
      { title: 'Trống', render: () => inDsa(<WeakItems rows={[]} />) },
    ],
  },
  {
    name: 'ResetTrackButton',
    layer: 'features',
    file: 'features/roadmap/components/reset-track-button.tsx',
    demos: [
      {
        title: '"Bắt đầu lại" → hỏi lại → thành công (vùng trạng thái cạnh nút, không kèm toast)',
        render: () => RESET,
      },
      {
        title: 'Lộ trình đã đổi trạng thái (thông báo cạnh nút)',
        render: () => (
          <ResetTrackButton action={demoResetStale} requestId={REQUEST_ID} trackId="dsa" />
        ),
      },
    ],
  },
  {
    name: 'TrackOverviewLearner',
    layer: 'features',
    file: 'features/roadmap/components/track-overview.tsx',
    demos: [
      {
        title: 'Người học đang theo: tiến độ, "Bắt đầu lại" và mục yếu (task 5.4)',
        render: () => (
          <div className="flex w-full flex-col gap-6">
            <TrackOverview
              track={{
                id: 'dsa',
                title: DSA,
                titleEn: 'Data Structures & Algorithms',
                accent: 'track-1',
                status: 'active',
              }}
              enrollment={{ status: 'active', roadmapVariant: '8w', budgetMinutes: 60 }}
              variants={[
                { id: '8w', label: '8 tuần', href: '/t/dsa?variant=8w', current: true },
                { id: '10w', label: '10 tuần', href: '/t/dsa?variant=10w', current: false },
              ]}
              template={[
                { label: 'Thứ 2 – Thứ 6', blocks: ['Ôn tập (tối đa 15 phút)', 'Bài mới'] },
              ]}
              throttle={[]}
              learner={
                <>
                  <TrackProgress
                    title={DSA}
                    progress={{ week: 3, weeks: 8, introduced: 20, total: 64 }}
                    actions={RESET}
                  />
                  <WeakItems rows={WEAK_ROWS} />
                </>
              }
            >
              <p className="text-sm text-muted-foreground">(Lộ trình theo tuần.)</p>
            </TrackOverview>
          </div>
        ),
      },
    ],
  },
]
