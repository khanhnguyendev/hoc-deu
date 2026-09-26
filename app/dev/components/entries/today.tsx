import type * as React from 'react'
import { LinkRow } from '@/components/patterns/link-row'
import { LoadingState } from '@/components/patterns/loading-state'
import { StatusPill } from '@/components/patterns/status-pill'
import { Button } from '@/components/ui/button'
import type { ResumeResult } from '@/features/today/actions'
import { BlockItemList } from '@/features/today/components/block-item-list'
import { MarkPlanSeen } from '@/features/today/components/mark-plan-seen'
import { PausedBanner } from '@/features/today/components/paused-banner'
import { PlanBlockCard } from '@/features/today/components/plan-block-card'
import { ResumeButton } from '@/features/today/components/resume-button'
import { ShadowingSentences } from '@/features/today/components/shadowing-sentences'
import { ThrottleNotice } from '@/features/today/components/throttle-notice'
import { TodayEmpty } from '@/features/today/components/today-empty'
import { TodayStats } from '@/features/today/components/today-stats'
import { TodayView } from '@/features/today/components/today-view'
import { WeakAreas } from '@/features/today/components/weak-areas'
import type { BlockItemSlot, TodaySlots } from '@/features/today/slots'
import type {
  BlockView,
  TodayPage,
  TrackProgressView,
  WeakTopicView,
} from '@/features/today/view-model'
import type { PlanBlock, StoredPlan } from '@/lib/domain/plan/types'
import type { TodayState } from '@/lib/plans/today'
import { vi } from '@/lib/i18n/vi'
import type { Entry } from '../types'

/**
 * `/dev/components` entries of features/today (task 5.1b; 5.2b and 5.4 later) — Part B-M5
 * decision 3: only that task edits this file. The rows are plain LinkRows standing in for the
 * registry's (the page builds the real ones, `todaySlots`); the actions are no-ops.
 */

const TODAY = '2026-09-28'
const DSA = 'Cấu trúc dữ liệu & Giải thuật'
const ENGLISH = 'Tiếng Anh cho môi trường IT'
const PLAN_ID = '00000000-0000-4000-8000-000000000001'
const OLD_PLAN_ID = '00000000-0000-4000-8000-000000000002'

const noopMarkSeen = async () => {}
const demoResume = async (): Promise<ResumeResult> => ({
  ok: true,
  message: vi.today.resumeResult.created,
})
const demoResumeFailure = async (): Promise<ResumeResult> => ({
  ok: false,
  message: vi.today.resumeResult.notOffered,
})

const row = (itemId: string, title: string, meta: string[], noNote = false): BlockItemSlot => ({
  itemId,
  noNote,
  row: (
    <LinkRow
      href={`/t/${itemId.replace(':', '/items/')}`}
      title={title}
      titleLang="en"
      meta={meta}
      trailing={<StatusPill status="not-started" />}
    />
  ),
})

const planBlock = (
  id: string,
  change: Partial<PlanBlock> & Pick<PlanBlock, 'kind'>,
): PlanBlock => ({
  id,
  trackId: id.split(':')[1] ?? 'dsa',
  estMinutes: 20,
  items: [],
  ...change,
})

const view = (change: Partial<BlockView> & Pick<BlockView, 'block'>): BlockView => ({
  trackTitle: DSA,
  accent: 'track-1',
  kindLabel: vi.today.kind.new,
  minutes: change.block.estMinutes,
  overBudget: false,
  checkIn: null,
  items: [],
  ...change,
})

const REVIEW_BLOCK = view({
  block: planBlock(`${TODAY}:dsa:review:1`, { kind: 'review', estMinutes: 10 }),
  kindLabel: vi.today.kind.review,
})
const NEW_BLOCK = view({
  block: planBlock(`${TODAY}:dsa:new:1`, { kind: 'new', estMinutes: 55 }),
  overBudget: true,
})
const ENGLISH_BLOCK = view({
  block: planBlock(`${TODAY}:english:new:1`, { kind: 'new', estMinutes: 12 }),
  trackTitle: ENGLISH,
  accent: 'track-2',
})
const SHADOWING_BLOCK = view({
  block: planBlock(`${TODAY}:english:practice:2`, {
    kind: 'practice',
    tag: 'shadowing',
    estMinutes: 3,
    shadowing: ['english:w01-blocker', 'english:w01-bandwidth'],
  }),
  trackTitle: ENGLISH,
  accent: 'track-2',
  kindLabel: vi.today.practice.shadowing,
})

const DEMO_SLOTS: TodaySlots = {
  [REVIEW_BLOCK.block.id]: {
    items: [row('dsa:lc-0001', 'Two Sum', ['#1', 'Easy', 'Arrays & Hashing'])],
    sentences: [],
  },
  [NEW_BLOCK.block.id]: {
    items: [
      row('dsa:lc-0049', 'Group Anagrams', ['#49', 'Medium', 'Arrays & Hashing']),
      row('dsa:lc-0002', 'Add Two Numbers', ['#2', 'Medium', 'Linked List'], true),
    ],
    sentences: [],
  },
  [ENGLISH_BLOCK.block.id]: {
    items: [
      row('english:w01-blocker', 'blocker', ['Cốt lõi']),
      row('english:w01-bandwidth', 'bandwidth', ['Cốt lõi']),
    ],
    sentences: [],
  },
  [SHADOWING_BLOCK.block.id]: {
    items: [],
    sentences: [
      {
        itemId: 'english:w01-blocker',
        text: "I have one blocker: I'm still waiting for access to the staging database.",
      },
      {
        itemId: 'english:w01-bandwidth',
        text: 'I have some bandwidth this afternoon if anyone needs help with code reviews.',
      },
    ],
  },
}

const DSA_TRACK: TrackProgressView = {
  trackId: 'dsa',
  title: DSA,
  accent: 'track-1',
  week: 2,
  weeks: 8,
  progress: 0.28,
  dueCount: 3,
  throttleMessage: null,
}
const ENGLISH_TRACK: TrackProgressView = {
  trackId: 'english',
  title: ENGLISH,
  accent: 'track-2',
  week: 3,
  weeks: 10,
  progress: 0.31,
  dueCount: 52,
  throttleMessage: 'Đang có 52 thẻ cần ôn — tạm giảm thẻ mới.',
}
const NEW_TRACK: TrackProgressView = { ...DSA_TRACK, week: 1, progress: 0, dueCount: 0 }

const WEAK_TOPICS: WeakTopicView[] = [
  { trackId: 'dsa', title: 'Arrays & Hashing', trackTitle: DSA, count: 3 },
  { trackId: 'dsa', title: 'Two Pointers', trackTitle: DSA, count: 2 },
]

const plan = (change: Partial<StoredPlan> = {}): StoredPlan => ({
  id: PLAN_ID,
  planDate: TODAY,
  version: 1,
  source: 'baseline',
  seenAt: null,
  blocks: [],
  tracks: {},
  ...change,
})
const OLD_PLAN = plan({ id: OLD_PLAN_ID, planDate: '2026-09-25' })

const page = (state: TodayState, change: Partial<Omit<TodayPage, 'data'>> = {}): TodayPage => ({
  data: {
    today: TODAY,
    now: '2026-09-28T03:00:00.000Z',
    state,
    catalog: { tracks: {}, items: {}, decks: {} },
    enrollments: [],
    items: {},
    versions: [],
  },
  blocks: [],
  tracks: [],
  streak: 0,
  weakTopics: [],
  markSeenPlanId: null,
  requestId: 'demo',
  ...change,
})

const DEMO_PAGES: { title: string; page: TodayPage }[] = [
  {
    title: 'Kế hoạch hôm nay: cảnh báo giảm thẻ mới, các khối, tiến độ, chủ đề yếu',
    page: page(
      { kind: 'plan', plan: plan(), blocks: {} },
      {
        blocks: [REVIEW_BLOCK, NEW_BLOCK, ENGLISH_BLOCK, SHADOWING_BLOCK],
        tracks: [DSA_TRACK, ENGLISH_TRACK],
        streak: 12,
        weakTopics: WEAK_TOPICS,
        markSeenPlanId: PLAN_ID,
      },
    ),
  },
  {
    title: 'Kế hoạch trống (RF-4)',
    page: page(
      { kind: 'plan', plan: plan(), blocks: {} },
      { tracks: [NEW_TRACK], markSeenPlanId: PLAN_ID },
    ),
  },
  {
    title: 'Đã tiếp tục hôm nay (quyết định 32): kế hoạch cũ, một khối đã check-in',
    page: page(
      { kind: 'resumed', plan: plan({ id: OLD_PLAN_ID, planDate: '2026-09-27' }), blocks: {} },
      {
        blocks: [
          {
            ...REVIEW_BLOCK,
            checkIn: {
              planId: OLD_PLAN_ID,
              blockId: REVIEW_BLOCK.block.id,
              trackId: 'dsa',
              status: 'done',
              minutes: 10,
              note: null,
              auto: false,
              checkedInOn: TODAY,
            },
          },
          NEW_BLOCK,
        ],
        tracks: [DSA_TRACK],
        streak: 1,
      },
    ),
  },
  {
    title: 'Tạm dừng, kế hoạch hơn 2 ngày: "Học tiếp hôm nay"',
    page: page(
      {
        kind: 'paused',
        plan: OLD_PLAN,
        unfinished: [NEW_BLOCK.block],
        blocks: {},
        daysSince: 3,
        offerResume: true,
      },
      { blocks: [NEW_BLOCK], tracks: [DSA_TRACK] },
    ),
  },
  {
    title: 'Tạm dừng, trong 2 ngày: không có "Học tiếp hôm nay"',
    page: page(
      {
        kind: 'paused',
        plan: plan({ id: OLD_PLAN_ID, planDate: '2026-09-26' }),
        unfinished: [NEW_BLOCK.block],
        blocks: {},
        daysSince: 2,
        offerResume: false,
      },
      { blocks: [NEW_BLOCK], tracks: [DSA_TRACK] },
    ),
  },
  {
    title: 'Chưa đến ngày bắt đầu',
    page: page({ kind: 'notStarted', startDate: '2026-10-03' }, { tracks: [NEW_TRACK] }),
  },
  { title: 'Chưa có lộ trình nào', page: page({ kind: 'noTracks' }) },
  { title: 'Lỗi: kế hoạch hôm nay không đọc được', page: page({ kind: 'unreadable' }) },
]

const wide = (node: React.ReactNode) => <div className="flex w-full flex-col gap-6">{node}</div>
const narrow = (node: React.ReactNode) => (
  <div className="flex w-full max-w-xl flex-col gap-4">{node}</div>
)

export const TODAY_ENTRIES: Entry[] = [
  {
    name: 'TodayView',
    layer: 'features',
    file: 'features/today/components/today-view.tsx',
    demos: [
      ...DEMO_PAGES.map(({ title, page: demoPage }) => ({
        title,
        render: () =>
          wide(
            <TodayView
              page={demoPage}
              slots={DEMO_SLOTS}
              markPlanSeen={noopMarkSeen}
              resumeToday={demoResume}
            />,
          ),
      })),
      {
        title: 'Đang tải (app/(app)/today/loading.tsx)',
        render: () => wide(<LoadingState variant="page" />),
      },
    ],
  },
  {
    name: 'PlanBlockCard',
    layer: 'features',
    file: 'features/today/components/plan-block-card.tsx',
    demos: [
      {
        title: 'Bài mới: dài hơn thời gian dự kiến, một bài chưa có ghi chú',
        render: () =>
          narrow(<PlanBlockCard view={NEW_BLOCK} slots={DEMO_SLOTS[NEW_BLOCK.block.id]} />),
      },
      {
        title: 'Đã check-in (Một phần, tự động)',
        render: () =>
          narrow(
            <PlanBlockCard
              view={{
                ...ENGLISH_BLOCK,
                checkIn: {
                  planId: PLAN_ID,
                  blockId: ENGLISH_BLOCK.block.id,
                  trackId: 'english',
                  status: 'partial',
                  minutes: 8,
                  note: null,
                  auto: true,
                  checkedInOn: TODAY,
                },
              }}
              slots={DEMO_SLOTS[ENGLISH_BLOCK.block.id]}
            />,
          ),
      },
      {
        title: 'Shadowing: câu mẫu thay cho danh sách bài',
        render: () =>
          narrow(
            <PlanBlockCard view={SHADOWING_BLOCK} slots={DEMO_SLOTS[SHADOWING_BLOCK.block.id]} />,
          ),
      },
      {
        title: 'Vùng actions (task 5.2b đặt nút check-in ở đây)',
        render: () =>
          narrow(
            <PlanBlockCard
              view={REVIEW_BLOCK}
              slots={DEMO_SLOTS[REVIEW_BLOCK.block.id]}
              actions={
                <Button size="lg" className="w-full">
                  Check-in
                </Button>
              }
            />,
          ),
      },
      {
        title: 'Trống: khối chưa có bài nào',
        render: () => narrow(<PlanBlockCard view={REVIEW_BLOCK} />),
      },
    ],
  },
  {
    name: 'BlockItemList',
    layer: 'features',
    file: 'features/today/components/block-item-list.tsx',
    demos: [
      {
        title: 'Các dòng, "Chưa có ghi chú" dưới bài chưa có ghi chú (RF-4)',
        render: () => narrow(<BlockItemList items={DEMO_SLOTS[NEW_BLOCK.block.id]!.items} />),
      },
      { title: 'Trống', render: () => narrow(<BlockItemList items={[]} />) },
    ],
  },
  {
    name: 'ShadowingSentences',
    layer: 'features',
    file: 'features/today/components/shadowing-sentences.tsx',
    demos: [
      {
        title: 'Câu mẫu (lang="en")',
        render: () =>
          narrow(
            <ShadowingSentences sentences={DEMO_SLOTS[SHADOWING_BLOCK.block.id]!.sentences} />,
          ),
      },
      { title: 'Trống', render: () => narrow(<ShadowingSentences sentences={[]} />) },
    ],
  },
  {
    name: 'PausedBanner',
    layer: 'features',
    file: 'features/today/components/paused-banner.tsx',
    demos: [
      {
        title: 'Hơn 2 ngày: "Học tiếp hôm nay"',
        render: () =>
          narrow(<PausedBanner planDate="2026-09-25" offerResume resume={demoResume} />),
      },
      {
        title: 'Trong 2 ngày',
        render: () =>
          narrow(<PausedBanner planDate="2026-09-26" offerResume={false} resume={demoResume} />),
      },
    ],
  },
  {
    name: 'ResumeButton',
    layer: 'features',
    file: 'features/today/components/resume-button.tsx',
    demos: [
      { title: 'Thành công (toast)', render: () => <ResumeButton resume={demoResume} /> },
      {
        title: 'Không còn khả dụng (thông báo cạnh nút)',
        render: () => <ResumeButton resume={demoResumeFailure} />,
      },
    ],
  },
  {
    name: 'MarkPlanSeen',
    layer: 'features',
    file: 'features/today/components/mark-plan-seen.tsx',
    demos: [
      {
        title: 'Không hiển thị gì: đánh dấu kế hoạch đã xem sau khi trình duyệt hiển thị /today',
        render: () => (
          <>
            <MarkPlanSeen planId={PLAN_ID} markPlanSeen={noopMarkSeen} />
            <p className="text-sm text-muted-foreground">(Không có giao diện.)</p>
          </>
        ),
      },
    ],
  },
  {
    name: 'TodayStats',
    layer: 'features',
    file: 'features/today/components/today-stats.tsx',
    demos: [
      {
        title: 'Chuỗi ngày, thẻ cần ôn, tiến độ từng lộ trình',
        render: () => narrow(<TodayStats streak={12} tracks={[DSA_TRACK, ENGLISH_TRACK]} />),
      },
      {
        title: 'Người học mới: tất cả bằng 0',
        render: () => narrow(<TodayStats streak={0} tracks={[NEW_TRACK]} />),
      },
    ],
  },
  {
    name: 'WeakAreas',
    layer: 'features',
    file: 'features/today/components/weak-areas.tsx',
    demos: [
      { title: 'Các chủ đề yếu', render: () => narrow(<WeakAreas topics={WEAK_TOPICS} />) },
      { title: 'Trống', render: () => narrow(<WeakAreas topics={[]} />) },
    ],
  },
  {
    name: 'ThrottleNotice',
    layer: 'features',
    file: 'features/today/components/throttle-notice.tsx',
    demos: [
      {
        title: 'Đang giảm thẻ mới (không giảm: không hiển thị gì)',
        render: () => narrow(<ThrottleNotice track={ENGLISH_TRACK} />),
      },
    ],
  },
  {
    name: 'TodayEmpty',
    layer: 'features',
    file: 'features/today/components/today-empty.tsx',
    demos: [
      {
        title: 'Chưa đến ngày bắt đầu',
        render: () => narrow(<TodayEmpty kind="notStarted" startDate="2026-10-03" />),
      },
      { title: 'Chưa có lộ trình nào', render: () => narrow(<TodayEmpty kind="noTracks" />) },
      { title: 'Kế hoạch trống', render: () => narrow(<TodayEmpty kind="noBlocks" />) },
    ],
  },
]
