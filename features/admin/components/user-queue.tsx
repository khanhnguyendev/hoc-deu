import { Ban, Inbox, UserCheck, UserX, type LucideIcon } from 'lucide-react'
import { DataList } from '@/components/patterns/data-list'
import { EmptyState } from '@/components/patterns/empty-state'
import { Section } from '@/components/patterns/section'
import { Badge } from '@/components/ui/badge'
import type { AccountStatus, Role } from '@/lib/auth/dal'
import { DEFAULT_SCHEDULE, localDay, type Schedule } from '@/lib/domain/time/localDay'
import { formatDay, formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { AdminActionResult } from '../actions'
import type { AdminUserRow } from '../queries'
import { UserRowActions } from './user-row-actions'
import { userRowId } from './user-row-id'

type Actions = {
  setUserStatus: (
    userId: string,
    status: 'active' | 'rejected' | 'suspended',
  ) => Promise<AdminActionResult>
  setUserRole: (userId: string, role: Role) => Promise<AdminActionResult>
}

/**
 * Sign-up days are calendar dates in Vietnam's time zone (the platform default, §5.1): the
 * admin's own schedule is not loaded here, and a sign-up is not a study day (no day start).
 */
const SIGN_UP_CALENDAR: Schedule = { timezone: DEFAULT_SCHEDULE.timezone, dayStartsAt: '00:00' }

const signUpDay = (createdAt: string) => formatDay(localDay(new Date(createdAt), SIGN_UP_CALENDAR))

/** The four sections, the queue first (§2.4). */
const SECTIONS: readonly { status: AccountStatus; empty: string; icon: LucideIcon }[] = [
  { status: 'pending', empty: vi.admin.users.emptyPending, icon: Inbox },
  { status: 'active', empty: vi.admin.users.emptyActive, icon: UserCheck },
  { status: 'suspended', empty: vi.admin.users.emptySuspended, icon: Ban },
  { status: 'rejected', empty: vi.admin.users.emptyRejected, icon: UserX },
]

function sectionTitle(status: AccountStatus, count: number): string {
  if (status === 'pending') {
    return vi.admin.users.pending.replace('{count}', formatNumber(count))
  }
  return vi.admin.users[status]
}

function UserRow({ user, actions }: { user: AdminUserRow; actions: Actions }) {
  // No display name: the e-mail is the name, shown once.
  const name = user.displayName ?? user.email ?? vi.admin.users.unnamed
  const email = user.displayName !== null ? user.email : null
  return (
    // The row's focus target: after an action keyboard focus follows the row, also into another
    // section (UserRowActions).
    <div
      id={userRowId(user.id)}
      tabIndex={-1}
      data-slot="user-row"
      className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span data-slot="user-name" className="font-medium break-words">
            {name}
          </span>
          {user.role === 'admin' && <Badge tone="primary">{vi.admin.users.adminBadge}</Badge>}
          {user.isSelf && <Badge tone="outline">{vi.admin.users.you}</Badge>}
        </div>
        {email && <span className="text-sm break-all text-muted-foreground">{email}</span>}
        <span className="text-sm text-muted-foreground">
          {vi.admin.users.joined.replace('{date}', signUpDay(user.createdAt))}
        </span>
      </div>
      {!user.isSelf && (
        <UserRowActions
          user={{ id: user.id, name, status: user.status, role: user.role }}
          setUserStatus={actions.setUserStatus}
          setUserRole={actions.setUserRole}
        />
      )}
    </div>
  )
}

/**
 * The approval queue at `/admin/users` (§2.4): pending accounts first ("Chờ duyệt (n)", oldest
 * first), then active, suspended and rejected ones — each row with its name, e-mail, sign-up day,
 * an admin badge and its actions. The acting admin's own row shows "Bạn" and no actions
 * (decision 17). `users` keeps the order of `listUsers()`; the actions come in as props.
 */
function UserQueue({
  users,
  setUserStatus,
  setUserRole,
}: { users: readonly AdminUserRow[] } & Actions) {
  const actions = { setUserStatus, setUserRole }
  return (
    <>
      {SECTIONS.map(({ status, empty, icon }) => {
        const rows = users.filter((user) => user.status === status)
        return (
          <Section key={status} title={sectionTitle(status, rows.length)}>
            <DataList
              items={rows}
              getKey={(user) => user.id}
              renderItem={(user) => <UserRow user={user} actions={actions} />}
              empty={<EmptyState icon={icon} title={empty} titleAs="h3" />}
            />
          </Section>
        )
      })}
    </>
  )
}

export { UserQueue }
