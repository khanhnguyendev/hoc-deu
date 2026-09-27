import { ErrorState } from '@/components/patterns/error-state'
import { LoadingState } from '@/components/patterns/loading-state'
import { ProgressView } from '@/features/progress/components/progress-view'
import { WeekNav } from '@/features/progress/components/week-nav'
import { WeeklySummary } from '@/features/progress/components/weekly-summary'
import type { ProgressPage } from '@/features/progress/view-model'
import { weeklySummary } from '@/lib/domain/stats/weeklySummary'
import type { Entry } from '../types'

/** `/dev/components` entries of features/progress (task 5.5) — Part B-M5 decision 3: only that task edits this file. */

const DEMO_TODAY = '2026-09-28'
const DEMO_DAYS = {
  '2026-09-28': {
    localDay: '2026-09-28',
    minutesByTrack: { dsa: 45, english: 15 },
    itemsDone: 3,
    completed: true,
  },
  '2026-09-29': {
    localDay: '2026-09-29',
    minutesByTrack: { dsa: 20 },
    itemsDone: 1,
    completed: false,
  },
}
const DEMO_TRACKS = [
  { id: 'dsa', title: 'Cấu trúc dữ liệu & Giải thuật', accent: 'track-1' },
  { id: 'english', title: 'Tiếng Anh cho môi trường IT', accent: 'track-2' },
]
const DEMO_WEEK = weeklySummary(DEMO_DAYS, DEMO_TODAY, new Set(['dsa', 'english']))
const DEMO_HEATMAP = Object.values(DEMO_DAYS).map((day) => ({
  day: day.localDay,
  minutes: Object.values(day.minutesByTrack).reduce((sum, m) => sum + m, 0),
}))

const DEMO_PAGE: ProgressPage = {
  today: DEMO_TODAY,
  heatmap: DEMO_HEATMAP,
  streak: 6,
  week: DEMO_WEEK,
  relation: 'current',
  previousWeek: '2026-09-21',
  nextWeek: null,
  tracks: DEMO_TRACKS,
}

/** Last week (UI I-4): the section says "Tuần trước", never "tuần này". */
const DEMO_LAST_WEEK_PAGE: ProgressPage = {
  ...DEMO_PAGE,
  week: weeklySummary(DEMO_DAYS, '2026-09-21', new Set(['dsa', 'english'])),
  relation: 'previous',
  previousWeek: '2026-09-14',
  nextWeek: '2026-09-28',
}

const DEMO_EMPTY_PAGE: ProgressPage = {
  today: DEMO_TODAY,
  heatmap: [],
  streak: 0,
  week: weeklySummary({}, DEMO_TODAY, new Set()),
  relation: 'current',
  previousWeek: '2026-09-21',
  nextWeek: null,
  tracks: [],
}

export const PROGRESS_ENTRIES: Entry[] = [
  {
    name: 'ProgressView',
    layer: 'features',
    file: 'features/progress/components/progress-view.tsx',
    demos: [
      {
        title: 'Có hoạt động: streak, lịch học, tuần này (điều hướng, thống kê, cột, ngày)',
        render: () => <ProgressView page={DEMO_PAGE} />,
      },
      {
        title: 'Tuần trước (UI I-4): tiêu đề "Tuần trước · …", không phải "tuần này"',
        render: () => <ProgressView page={DEMO_LAST_WEEK_PAGE} />,
      },
      {
        title: 'Trống (RF-4): học viên mới, chưa có ngày học nào',
        render: () => <ProgressView page={DEMO_EMPTY_PAGE} />,
      },
      {
        title: 'Đang tải (app/(app)/progress/loading.tsx)',
        render: () => <LoadingState variant="page" />,
      },
      {
        title: 'Lỗi (app/(app)/progress/error.tsx)',
        render: () => <ErrorState titleAs="h1" onRetry={() => {}} />,
      },
    ],
  },
  {
    name: 'WeeklySummary',
    layer: 'features',
    file: 'features/progress/components/weekly-summary.tsx',
    demos: [
      {
        title: 'Tuần này: điều hướng, thống kê, cột theo lộ trình, ngày (hoàn thành / chưa)',
        render: () => (
          <WeeklySummary
            week={DEMO_WEEK}
            tracks={DEMO_TRACKS}
            title="Tuần này · 28/09 – 04/10"
            nav={<WeekNav previousWeek="2026-09-21" nextWeek={null} />}
          />
        ),
      },
      {
        title: 'Chưa theo lộ trình nào',
        render: () => (
          <WeeklySummary
            week={weeklySummary({}, DEMO_TODAY, new Set())}
            tracks={[]}
            title="Tuần này · 28/09 – 04/10"
          />
        ),
      },
    ],
  },
  {
    name: 'WeekNav',
    layer: 'features',
    file: 'features/progress/components/week-nav.tsx',
    demos: [
      {
        title:
          'Tuần trước / tuần sau; "Tuần sau" khoá ở tuần hiện tại, "Tuần trước" ở tuần đầu của lịch sử',
        render: () => (
          <div className="flex w-full max-w-sm flex-col gap-4">
            <WeekNav previousWeek="2026-09-07" nextWeek="2026-09-21" />
            <WeekNav previousWeek="2026-09-21" nextWeek={null} />
            <WeekNav previousWeek={null} nextWeek="2025-09-01" />
          </div>
        ),
      },
    ],
  },
]
