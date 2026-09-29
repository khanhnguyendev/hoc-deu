import { LoadingState } from '@/components/patterns/loading-state'
import type { AdminActionResult } from '@/features/admin/actions'
import { DraftsList } from '@/features/admin/components/drafts-list'
import { PublishButton } from '@/features/admin/components/publish-button'
import { PublishRequests } from '@/features/admin/components/publish-requests'
import type { Drafts, PublishRequestView } from '@/features/admin/content'
import { vi } from '@/lib/i18n/vi'
import type { Entry } from '../types'

/** `/dev/components` entries of publish requests (task 6.7a, Part B-M6 decision 3). */

const copy = vi.publish

const PR = { href: 'https://github.com/khanhnguyendev/hoc-deu/pull/41', label: 'PR #41' }

/** The actions as no-ops: they "succeed" and toast, but nothing changes. */
const demoRequested = async (): Promise<AdminActionResult> => ({
  ok: true,
  message: copy.results.requested,
})
const demoCancelled = async (): Promise<AdminActionResult> => ({
  ok: true,
  message: copy.results.cancelled,
})
const demoFailed = async (): Promise<AdminActionResult> => ({
  ok: false,
  message: copy.errors.failed,
})

const DSA = 'Cấu trúc dữ liệu & Giải thuật'

/** Drafts with every publish state: none yet, pending, pending in a PR; a bot note's badge. */
const DEMO_DRAFTS: Drafts = {
  tracks: [],
  items: [
    {
      id: 'dsa:lc-0146',
      title: 'LRU Cache',
      titleLang: 'en',
      meta: [DSA, 'Problem'],
      href: '/t/dsa/items/lc-0146',
      target: 'dsa:lc-0146',
      checklist: 'problem',
      verification: null,
      request: null,
    },
    {
      id: 'dsa:lesson-linked-list',
      title: 'Danh sách liên kết',
      titleLang: undefined,
      meta: [DSA, 'Lesson'],
      href: '/t/dsa/items/lesson-linked-list',
      target: 'dsa:lesson-linked-list',
      checklist: 'item',
      verification: null,
      request: { requestId: 7, pr: null },
    },
  ],
  notes: [
    {
      id: 'dsa:lc-0206#note',
      title: 'Reverse Linked List',
      titleLang: 'en',
      meta: [DSA, 'Ghi chú'],
      href: '/t/dsa/items/lc-0206',
      target: 'dsa:lc-0206#note',
      checklist: 'problem',
      verification: 'tested-by-bot',
      request: { requestId: 8, pr: PR },
    },
    {
      id: 'dsa:lc-0021#note',
      title: 'Merge Two Sorted Lists',
      titleLang: 'en',
      meta: [DSA, 'Ghi chú'],
      href: '/t/dsa/items/lc-0021',
      target: 'dsa:lc-0021#note',
      checklist: 'problem',
      verification: 'tested',
      request: null,
    },
  ],
}

const request = (overrides: Partial<PublishRequestView>): PublishRequestView => ({
  id: 1,
  target: 'dsa:lc-0206#note',
  title: 'Reverse Linked List',
  titleLang: 'en',
  kind: 'Ghi chú',
  href: '/t/dsa/items/lc-0206',
  status: 'pending',
  statusLabel: copy.requests.status.pending,
  pr: PR,
  requestedAt: '09:00, 2 tháng 10, 2026',
  ...overrides,
})

const DEMO_REQUESTS: PublishRequestView[] = [
  request({ id: 3 }),
  request({
    id: 2,
    target: 'dsa:lesson-linked-list',
    title: 'Danh sách liên kết',
    titleLang: undefined,
    kind: 'Lesson',
    href: '/t/dsa/items/lesson-linked-list',
    pr: null,
    requestedAt: '08:30, 2 tháng 10, 2026',
  }),
  request({
    id: 1,
    target: 'dsa:lc-0001#note',
    title: 'Two Sum',
    href: '/t/dsa/items/lc-0001',
    status: 'merged',
    statusLabel: copy.requests.status.merged,
    requestedAt: '21:15, 28 tháng 9, 2026',
  }),
  request({
    id: 0,
    target: 'dsa:lc-4242',
    title: 'dsa:lc-4242',
    titleLang: undefined,
    kind: null,
    href: null,
    status: 'cancelled',
    statusLabel: copy.requests.status.cancelled,
    pr: null,
    requestedAt: '10:00, 27 tháng 9, 2026',
  }),
]

export const PUBLISH_ENTRIES: Entry[] = [
  {
    name: 'PublishButton',
    layer: 'features',
    file: 'features/admin/components/publish-button.tsx',
    demos: [
      {
        title: 'Bản nháp: "Xuất bản" mở danh sách kiểm tra',
        render: () => (
          <PublishButton
            target="dsa:lc-0206#note"
            title="Reverse Linked List"
            titleLang="en"
            checklist="problem"
            request={null}
            requestPublish={demoRequested}
            cancelPublish={demoCancelled}
          />
        ),
      },
      {
        title: 'Đang chờ, chưa có pull request',
        render: () => (
          <PublishButton
            target="dsa:lesson-linked-list"
            title="Danh sách liên kết"
            checklist="item"
            request={{ requestId: 7, pr: null }}
            requestPublish={demoRequested}
            cancelPublish={demoCancelled}
          />
        ),
      },
      {
        title: 'Xuất bản thất bại: hộp thoại vẫn mở, lỗi trong hộp thoại',
        render: () => (
          <PublishButton
            target="dsa:lc-0206#note"
            title="Reverse Linked List"
            titleLang="en"
            checklist="problem"
            request={null}
            requestPublish={demoFailed}
            cancelPublish={demoFailed}
          />
        ),
      },
      {
        title: 'Huỷ thất bại: lỗi bên cạnh nút',
        render: () => (
          <PublishButton
            target="dsa:lesson-linked-list"
            title="Danh sách liên kết"
            checklist="item"
            request={{ requestId: 9, pr: null }}
            requestPublish={demoFailed}
            cancelPublish={demoFailed}
          />
        ),
      },
      {
        title: 'Đang chờ, trong một pull request',
        render: () => (
          <PublishButton
            target="dsa:lc-0206#note"
            title="Reverse Linked List"
            titleLang="en"
            checklist="problem"
            request={{ requestId: 8, pr: PR }}
            requestPublish={demoRequested}
            cancelPublish={demoCancelled}
          />
        ),
      },
    ],
  },
  {
    name: 'DraftsList — xuất bản',
    layer: 'features',
    file: 'features/admin/components/drafts-list.tsx',
    demos: [
      {
        title: 'Mục và ghi chú nháp với trạng thái xuất bản; huy hiệu của ghi chú do bot viết',
        render: () => (
          <div className="w-full">
            <DraftsList
              drafts={DEMO_DRAFTS}
              requestPublish={demoRequested}
              cancelPublish={demoCancelled}
            />
          </div>
        ),
      },
    ],
  },
  {
    name: 'PublishRequests',
    layer: 'features',
    file: 'features/admin/components/publish-requests.tsx',
    demos: [
      {
        title: 'Đang chờ trước, rồi các yêu cầu gần đây',
        render: () => (
          <div className="w-full">
            <PublishRequests requests={{ state: 'ready', rows: DEMO_REQUESTS }} />
          </div>
        ),
      },
      {
        title: 'Đang tải (cùng /admin/content: app/(admin)/admin/content/loading.tsx)',
        render: () => (
          <div className="w-full">
            <LoadingState variant="page" />
          </div>
        ),
      },
      {
        title: 'Chưa có yêu cầu',
        render: () => (
          <div className="w-full">
            <PublishRequests requests={{ state: 'empty' }} />
          </div>
        ),
      },
      {
        title: 'Không đọc được',
        render: () => (
          <div className="w-full">
            <PublishRequests requests={{ state: 'error' }} />
          </div>
        ),
      },
    ],
  },
]
