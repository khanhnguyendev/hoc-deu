import { FocusLayout } from '@/components/patterns/focus-layout'
import { Button } from '@/components/ui/button'
import type { AdminActionResult } from '@/features/admin/actions'
import { UserQueue } from '@/features/admin/components/user-queue'
import { UserRowActions } from '@/features/admin/components/user-row-actions'
import type { AdminUserRow } from '@/features/admin/queries'
import { vi } from '@/lib/i18n/vi'
import type { Entry } from '../types'

/**
 * `/dev/components` entries of features/admin, plus FocusLayout (Part B-M5 decision 3): task 5.6
 * changes these components in wave 4, while 5.2c owns `registry.tsx`, so their demos live here.
 */

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
  {
    name: 'FocusLayout',
    layer: 'patterns',
    file: 'components/patterns/focus-layout.tsx',
    demos: [
      {
        title: 'Wordmark, skip link, centred main (narrow)',
        render: () => (
          <div className="h-64 w-full overflow-hidden rounded-lg border border-border">
            <FocusLayout>
              <p className="text-center text-sm text-muted-foreground">Nội dung trang.</p>
            </FocusLayout>
          </div>
        ),
      },
      {
        title: 'Wide, with header actions',
        render: () => (
          <div className="h-64 w-full overflow-hidden rounded-lg border border-border">
            <FocusLayout width="wide" headerActions={<Button variant="outline">Trợ giúp</Button>}>
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
