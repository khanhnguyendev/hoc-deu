import { FocusLayout } from '@/components/patterns/focus-layout'
import { LoadingState } from '@/components/patterns/loading-state'
import { Button } from '@/components/ui/button'
import type { AdminActionResult } from '@/features/admin/actions'
import { AdminOverview } from '@/features/admin/components/admin-overview'
import { AdminWarnings } from '@/features/admin/components/admin-warnings'
import { CatalogStats } from '@/features/admin/components/catalog-stats'
import { ContentCoverage } from '@/features/admin/components/content-coverage'
import { DraftsList } from '@/features/admin/components/drafts-list'
import { UserQueue } from '@/features/admin/components/user-queue'
import { UserRowActions } from '@/features/admin/components/user-row-actions'
import type { CoverageRow, Drafts, RoadmapCoverage, TrackStats } from '@/features/admin/content'
import {
  buildAdminOverview,
  MB,
  type AdminWarning,
  type MetricReading,
  type OpsMetrics,
  type RateLimitOverview,
} from '@/features/admin/overview'
import type { AdminUserRow } from '@/features/admin/queries'
import { vi } from '@/lib/i18n/vi'
import type { Entry } from '../types'

/**
 * `/dev/components` entries of features/admin, plus FocusLayout (Part B-M5 decision 3): task 5.6
 * changes these components in wave 4, while 5.2c owns `registry.tsx`, so their demos live here.
 */

// ---------------------------------------------------------------------------------------------
// Admin overview and content (task 5.6): fixed data, a fixed "now".
// ---------------------------------------------------------------------------------------------

const DEMO_NOW = new Date('2026-09-27T12:00:00Z')
const HOUR_MS = 3_600_000
const DEMO_DSA = 'Cấu trúc dữ liệu & Giải thuật'
const DEMO_ENGLISH = 'Tiếng Anh cho môi trường IT'

/** A metric the cron recorded at DEMO_NOW, of an instant `hours` older. */
const demoInstant = (hours: number): MetricReading => ({
  value: (DEMO_NOW.getTime() - hours * HOUR_MS) / 1000,
  recordedAt: DEMO_NOW.toISOString(),
})
const DEMO_COUNTS = {
  users: { pending: 2, active: 7, suspended: 1, rejected: 1 },
  learnersCompleted7d: 4,
  plansCreated7d: 23,
}
const DEMO_NO_METRICS: OpsMetrics = {
  'db.size_bytes': null,
  'backup.last_success_at': null,
  'restore_test.last_success_at': null,
  'cron.last_run_at': null,
}
const DEMO_METRICS: OpsMetrics = {
  'db.size_bytes': { value: 360 * MB, recordedAt: DEMO_NOW.toISOString() },
  'backup.last_success_at': demoInstant(40),
  'restore_test.last_success_at': demoInstant(3 * 24),
  'cron.last_run_at': demoInstant(1),
}
const DEMO_COVERAGE_WARNING = {
  trackId: 'dsa',
  trackTitle: DEMO_DSA,
  variant: '10w',
  weeks: [4, 5],
}

/** Upstash configured, no fail-open events (task 6.1): neither new warning fires. */
const DEMO_RATE_LIMIT_OK: RateLimitOverview = { mode: 'upstash', failOpen7d: 0 }
/** No Upstash configured, a few fail-open events in the last 7 days (task 6.1). */
const DEMO_RATE_LIMIT_MEMORY: RateLimitOverview = { mode: 'memory', failOpen7d: 3 }

const DEMO_OVERVIEW = buildAdminOverview({
  counts: DEMO_COUNTS,
  metrics: DEMO_METRICS,
  coverage: [DEMO_COVERAGE_WARNING],
  rateLimit: DEMO_RATE_LIMIT_OK,
  vercelEnv: 'production',
  now: DEMO_NOW,
})
const DEMO_FIRST_RUN = buildAdminOverview({
  counts: {
    users: { pending: 1, active: 1, suspended: 0, rejected: 0 },
    learnersCompleted7d: 0,
    plansCreated7d: 0,
  },
  metrics: DEMO_NO_METRICS,
  coverage: [],
  rateLimit: DEMO_RATE_LIMIT_OK,
  vercelEnv: 'production',
  now: DEMO_NOW,
})
/**
 * The cron has run (36+ hours ago), yet no backup or restore test ever succeeded; the DB size was
 * last measured then too.
 */
const DEMO_NO_RUNS = buildAdminOverview({
  counts: DEMO_COUNTS,
  metrics: {
    ...DEMO_NO_METRICS,
    'db.size_bytes': {
      value: 42 * MB,
      recordedAt: new Date(DEMO_NOW.getTime() - 40 * HOUR_MS).toISOString(),
    },
    'cron.last_run_at': {
      value: (DEMO_NOW.getTime() - 40 * HOUR_MS) / 1000,
      recordedAt: new Date(DEMO_NOW.getTime() - 40 * HOUR_MS).toISOString(),
    },
  },
  coverage: [],
  rateLimit: DEMO_RATE_LIMIT_OK,
  vercelEnv: 'production',
  now: DEMO_NOW,
})
/** Every warning kind and tone: the red coverage warning, a critical DB size, the rest. */
const DEMO_ALL_WARNINGS: AdminWarning[] = [
  ...buildAdminOverview({
    counts: DEMO_COUNTS,
    metrics: {
      'db.size_bytes': { value: 460 * MB, recordedAt: DEMO_NOW.toISOString() },
      'backup.last_success_at': demoInstant(40),
      'restore_test.last_success_at': demoInstant(9 * 24),
      'cron.last_run_at': demoInstant(1),
    },
    coverage: [DEMO_COVERAGE_WARNING],
    // The in-memory rate-limit warning and the fail-open count, task 6.1.
    rateLimit: DEMO_RATE_LIMIT_MEMORY,
    vercelEnv: 'production',
    now: DEMO_NOW,
  }).warnings,
  ...buildAdminOverview({
    counts: DEMO_COUNTS,
    metrics: {
      ...DEMO_NO_METRICS,
      'db.size_bytes': { value: 120 * MB, recordedAt: DEMO_NOW.toISOString() },
    },
    coverage: [],
    rateLimit: DEMO_RATE_LIMIT_OK,
    vercelEnv: 'production',
    now: DEMO_NOW,
  }).warnings,
  // "Chưa có lần … thành công nào": the cron has run, no success was ever read.
  ...DEMO_NO_RUNS.warnings,
  // Merged from three pages: each key once (a page's warning keys are unique only within it).
].map((warning, index) => ({ ...warning, key: `${warning.key}:${index}` }))

const DEMO_STATS: TrackStats = {
  trackTitle: DEMO_DSA,
  rows: [
    { type: 'lesson', label: 'Lesson', active: 5, draft: 1, retired: 0 },
    { type: 'problem', label: 'Problem', active: 114, draft: 2, retired: 0 },
    { type: 'prompt', label: 'Prompt', active: 4, draft: 0, retired: 0 },
  ],
  total: 126,
  verification: { tested: 24, compileOnly: 3, noNote: 89 },
}

const demoWeek = (week: number, overrides: Partial<CoverageRow> = {}): CoverageRow => ({
  week,
  learners: 0,
  lessons: [{ topic: `topic-${week}`, title: `Chủ đề ${week}`, present: true }],
  notedProblems: 9,
  placedProblems: 9,
  coreCards: 0,
  extendedCards: 0,
  exercises: 0,
  prompts: 1,
  state: 'covered',
  ...overrides,
})
const demoGap = (week: number, state: 'red' | 'gap'): CoverageRow =>
  demoWeek(week, {
    lessons: [{ topic: `topic-${week}`, title: `Chủ đề ${week}`, present: false }],
    notedProblems: 0,
    placedProblems: 10,
    state,
  })
const DEMO_COVERAGE: RoadmapCoverage = {
  trackTitle: DEMO_DSA,
  variant: '10w',
  variantLabel: '10 tuần',
  columns: ['lessons', 'notes', 'cards', 'prompts'],
  rows: [
    demoWeek(1),
    demoWeek(2, { learners: 2 }),
    demoWeek(3, { learners: 1 }),
    demoGap(4, 'red'),
    demoGap(5, 'red'),
    demoGap(6, 'gap'),
  ],
  horizon: 5,
  maxLearnerWeek: 3,
}
const DEMO_DRAFTS: Drafts = {
  tracks: [{ id: 'system-design', title: 'Thiết kế hệ thống', href: '/t/system-design' }],
  items: [
    {
      id: 'dsa:lc-0146',
      title: 'LRU Cache',
      titleLang: 'en',
      meta: [DEMO_DSA, 'Problem'],
      href: '/t/dsa/items/lc-0146',
    },
  ],
  notes: [
    {
      id: 'dsa:lc-0206#note',
      title: 'Reverse Linked List',
      titleLang: 'en',
      meta: [DEMO_DSA, 'Ghi chú'],
      href: '/t/dsa/items/lc-0206',
    },
  ],
}

const ADMIN_OVERVIEW_ENTRIES: Entry[] = [
  {
    name: 'AdminOverview',
    layer: 'features',
    file: 'features/admin/components/admin-overview.tsx',
    demos: [
      {
        title: 'Cảnh báo (đỏ trước), số liệu, hệ thống, liên kết',
        render: () => (
          <div className="flex w-full flex-col gap-6">
            <AdminOverview page={DEMO_OVERVIEW} />
          </div>
        ),
      },
      {
        title: 'Trước lần chạy đầu của cron: chưa có dữ liệu, không cảnh báo',
        render: () => (
          <div className="flex w-full flex-col gap-6">
            <AdminOverview page={DEMO_FIRST_RUN} />
          </div>
        ),
      },
      {
        title:
          'Cron đã chạy nhưng chưa có lần sao lưu hay kiểm tra khôi phục thành công; dung lượng đo đã hơn 36 giờ',
        render: () => (
          <div className="flex w-full flex-col gap-6">
            <AdminOverview page={DEMO_NO_RUNS} />
          </div>
        ),
      },
      {
        title: 'Đang tải (app/(admin)/admin/loading.tsx)',
        render: () => (
          <div className="w-full">
            <LoadingState variant="page" />
          </div>
        ),
      },
    ],
  },
  {
    name: 'AdminWarnings',
    layer: 'features',
    file: 'features/admin/components/admin-warnings.tsx',
    demos: [
      {
        title:
          'Mọi loại: độ phủ nội dung (đỏ), dung lượng nghiêm trọng, sao lưu, kiểm tra khôi phục, 100 MB, chưa từng thành công',
        render: () => (
          <div className="w-full">
            <AdminWarnings warnings={DEMO_ALL_WARNINGS} />
          </div>
        ),
      },
      {
        title: 'Không có cảnh báo',
        render: () => (
          <div className="w-full">
            <AdminWarnings warnings={[]} />
          </div>
        ),
      },
    ],
  },
  {
    name: 'CatalogStats',
    layer: 'features',
    file: 'features/admin/components/catalog-stats.tsx',
    demos: [
      {
        title: 'Theo loại và trạng thái, kèm kiểm chứng lời giải',
        render: () => (
          <div className="w-full">
            <CatalogStats stats={DEMO_STATS} />
          </div>
        ),
      },
      {
        title: 'Lộ trình không có problem (không có dòng kiểm chứng)',
        render: () => (
          <div className="w-full">
            <CatalogStats
              stats={{
                trackTitle: DEMO_ENGLISH,
                rows: [
                  { type: 'flashcard', label: 'Flashcard', active: 210, draft: 0, retired: 0 },
                  { type: 'exercise', label: 'Exercise', active: 18, draft: 0, retired: 0 },
                ],
                total: 228,
                verification: null,
              }}
            />
          </div>
        ),
      },
      {
        title: 'Chưa có mục nào',
        render: () => (
          <div className="w-full">
            <CatalogStats
              stats={{
                trackTitle: 'Thiết kế hệ thống',
                rows: [{ type: 'lesson', label: 'Lesson', active: 0, draft: 0, retired: 0 }],
                total: 0,
                verification: null,
              }}
            />
          </div>
        ),
      },
    ],
  },
  {
    name: 'ContentCoverage',
    layer: 'features',
    file: 'features/admin/components/content-coverage.tsx',
    demos: [
      {
        title: 'Học viên tới tuần 3: tuần 4–5 thiếu nội dung là dòng đỏ, tuần 6 còn thiếu',
        render: () => (
          <div className="w-full">
            <ContentCoverage coverage={DEMO_COVERAGE} />
          </div>
        ),
      },
      {
        title: 'Chưa có học viên có kế hoạch trong 14 ngày',
        render: () => (
          <div className="w-full">
            <ContentCoverage
              coverage={{
                ...DEMO_COVERAGE,
                variant: 'quiet',
                rows: DEMO_COVERAGE.rows!.map((row) => ({
                  ...row,
                  learners: 0,
                  state: row.state === 'red' ? 'gap' : row.state,
                })),
                horizon: null,
                maxLearnerWeek: null,
              }}
            />
          </div>
        ),
      },
      {
        title: 'Cột theo loại mục của lộ trình (tiếng Anh)',
        render: () => (
          <div className="w-full">
            <ContentCoverage
              coverage={{
                trackTitle: DEMO_ENGLISH,
                variant: '10w',
                variantLabel: '10 tuần',
                columns: ['cards', 'exercises', 'prompts'],
                rows: [
                  demoWeek(1, { lessons: [], coreCards: 12, extendedCards: 18, exercises: 6 }),
                  demoWeek(2, { lessons: [], coreCards: 16, extendedCards: 14, exercises: 6 }),
                ],
                horizon: null,
                maxLearnerWeek: null,
              }}
            />
          </div>
        ),
      },
      {
        title: 'Biến thể chưa có tệp lộ trình',
        render: () => (
          <div className="w-full">
            <ContentCoverage
              coverage={{
                ...DEMO_COVERAGE,
                variant: '8w',
                variantLabel: '8 tuần',
                rows: null,
                horizon: null,
                maxLearnerWeek: null,
              }}
            />
          </div>
        ),
      },
      {
        title: 'Đang tải /admin/content (app/(admin)/admin/content/loading.tsx)',
        render: () => (
          <div className="w-full">
            <LoadingState variant="page" />
          </div>
        ),
      },
    ],
  },
  {
    name: 'DraftsList',
    layer: 'features',
    file: 'features/admin/components/drafts-list.tsx',
    demos: [
      {
        title: 'Lộ trình, mục và ghi chú nháp',
        render: () => (
          <div className="w-full">
            <DraftsList drafts={DEMO_DRAFTS} />
          </div>
        ),
      },
      {
        title: 'Không có bản nháp',
        render: () => (
          <div className="w-full">
            <DraftsList drafts={{ tracks: [], items: [], notes: [] }} />
          </div>
        ),
      },
    ],
  },
]

const DEMO_ADMIN_SELF = 'Nguyễn Văn An'

/** The admin actions as no-ops: they "succeed" and toast, but nothing changes. */
const demoSetUserStatus = async (): Promise<AdminActionResult> => ({
  ok: true,
  message: vi.admin.results.approved,
})
const demoSetUserRole = async (): Promise<AdminActionResult> => ({
  ok: true,
  message: vi.admin.results.promoted,
})
const demoFailure = async (): Promise<AdminActionResult> => ({
  ok: false,
  message: vi.admin.errors.changed,
})

const demoUser = (user: Partial<AdminUserRow> & Pick<AdminUserRow, 'id'>): AdminUserRow => ({
  email: `${user.id}@example.test`,
  displayName: null,
  role: 'learner',
  status: 'active',
  createdAt: '2026-01-12T02:00:00Z',
  approvedAt: null,
  onboardedAt: null,
  isSelf: false,
  ...user,
})

// Row names are constants: e2e/components.spec.ts reads every quoted `name` property in the
// catalog files as a catalog entry name.
const DEMO_LEARNER = 'Trần Thị Bình'
const DEMO_OTHER_ADMIN = 'Lê Văn Dũng'

const DEMO_ADMIN_USERS: AdminUserRow[] = [
  demoUser({
    id: 'binh',
    displayName: DEMO_LEARNER,
    status: 'pending',
    createdAt: '2026-02-02T09:30:00Z',
  }),
  demoUser({ id: 'cuong', status: 'pending', createdAt: '2026-02-03T20:00:00Z' }),
  demoUser({ id: 'an', displayName: DEMO_ADMIN_SELF, role: 'admin', isSelf: true }),
  demoUser({ id: 'dung', displayName: DEMO_OTHER_ADMIN, role: 'admin' }),
  demoUser({ id: 'giang', displayName: 'Phạm Thu Giang' }),
  demoUser({ id: 'hai', displayName: 'Hoàng Minh Hải', status: 'suspended' }),
]

export const ADMIN_ENTRIES: Entry[] = [
  ...ADMIN_OVERVIEW_ENTRIES,
  {
    name: 'FocusLayout',
    layer: 'patterns',
    file: 'components/patterns/focus-layout.tsx',
    demos: [
      {
        title: 'Wordmark, skip link, centred main (narrow); the catalog has its own Toaster',
        render: () => (
          <div className="h-64 w-full overflow-hidden rounded-lg border border-border">
            <FocusLayout toaster={false}>
              <p className="text-center text-sm text-muted-foreground">Nội dung trang.</p>
            </FocusLayout>
          </div>
        ),
      },
      {
        title: 'Wide, with header actions',
        render: () => (
          <div className="h-64 w-full overflow-hidden rounded-lg border border-border">
            <FocusLayout
              width="wide"
              headerActions={<Button variant="outline">Trợ giúp</Button>}
              toaster={false}
            >
              <p className="text-center text-sm text-muted-foreground">Nội dung trang rộng.</p>
            </FocusLayout>
          </div>
        ),
      },
    ],
  },
  {
    name: 'UserQueue',
    layer: 'features',
    file: 'features/admin/components/user-queue.tsx',
    demos: [
      {
        title: 'Chờ duyệt trước, rồi các mục khác; hàng của bạn không có thao tác',
        render: () => (
          <div className="flex w-full flex-col gap-6">
            <UserQueue
              users={DEMO_ADMIN_USERS}
              setUserStatus={demoSetUserStatus}
              setUserRole={demoSetUserRole}
            />
          </div>
        ),
      },
      {
        title: 'Không có tài khoản nào chờ duyệt',
        render: () => (
          <div className="flex w-full flex-col gap-6">
            <UserQueue
              // Own ids: each row's id is its focus target, and ids are unique on the page.
              users={DEMO_ADMIN_USERS.filter((user) => user.status !== 'pending').map((user) => ({
                ...user,
                id: `empty-queue-${user.id}`,
              }))}
              setUserStatus={demoSetUserStatus}
              setUserRole={demoSetUserRole}
            />
          </div>
        ),
      },
    ],
  },
  {
    name: 'UserRowActions',
    layer: 'features',
    file: 'features/admin/components/user-row-actions.tsx',
    demos: [
      {
        title:
          'Theo trạng thái: chờ duyệt, đang hoạt động (học viên, quản trị), tạm khoá, bị từ chối',
        render: () => (
          <div className="flex flex-col gap-4">
            {(
              [
                ['pending', 'learner'],
                ['active', 'learner'],
                ['active', 'admin'],
                ['suspended', 'learner'],
                ['rejected', 'learner'],
              ] as const
            ).map(([status, role]) => (
              <UserRowActions
                key={`${status}-${role}`}
                user={{ id: `${status}-${role}`, name: DEMO_LEARNER, status, role }}
                setUserStatus={demoSetUserStatus}
                setUserRole={demoSetUserRole}
              />
            ))}
          </div>
        ),
      },
      {
        title: 'Thao tác thất bại: thông báo trong hàng và toast',
        render: () => (
          <UserRowActions
            user={{ id: 'failed', name: DEMO_OTHER_ADMIN, status: 'pending', role: 'learner' }}
            setUserStatus={demoFailure}
            setUserRole={demoFailure}
          />
        ),
      },
    ],
  },
]
