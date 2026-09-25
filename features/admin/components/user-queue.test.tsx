import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi as mock } from 'vitest'
import type { Role } from '@/lib/auth/dal'
import type { AdminActionResult } from '../actions'
import type { AdminUserRow } from '../queries'
import { UserQueue } from './user-queue'
import { userRowId } from './user-row-id'

const row = (overrides: Partial<AdminUserRow> & Pick<AdminUserRow, 'id'>): AdminUserRow => ({
  email: `${overrides.id}@example.test`,
  displayName: `Người ${overrides.id}`,
  role: 'learner',
  status: 'active',
  createdAt: '2026-01-10T03:00:00+00:00',
  approvedAt: null,
  onboardedAt: null,
  isSelf: false,
  ...overrides,
})

const ME = row({ id: 'me', displayName: 'Quản trị viên An', role: 'admin', isSelf: true })
const USERS: AdminUserRow[] = [
  // 20:00 UTC on 3 February is 03:00 on 4 February in Asia/Ho_Chi_Minh.
  row({ id: 'p1', displayName: 'Chờ Một', status: 'pending', createdAt: '2026-02-03T20:00:00Z' }),
  row({ id: 'p2', displayName: null, email: 'cho-hai@example.test', status: 'pending' }),
  ME,
  row({ id: 'a1', displayName: 'Admin Khác', role: 'admin' }),
  row({ id: 'l1', displayName: 'Học Viên' }),
  row({ id: 's1', displayName: 'Bị Khoá', status: 'suspended' }),
  row({ id: 'r1', displayName: 'Bị Loại', status: 'rejected' }),
]

function setup(users: readonly AdminUserRow[] = USERS) {
  const ok: AdminActionResult = { ok: true, message: 'Đã xong.' }
  const setUserStatus = mock.fn<
    (id: string, status: 'active' | 'rejected' | 'suspended') => Promise<AdminActionResult>
  >(async () => ok)
  const setUserRole = mock.fn<(id: string, role: Role) => Promise<AdminActionResult>>(
    async () => ok,
  )
  render(<UserQueue users={users} setUserStatus={setUserStatus} setUserRole={setUserRole} />)
  return { setUserStatus, setUserRole, user: userEvent.setup() }
}

const region = (name: string | RegExp) => screen.getByRole('region', { name })
const rowOf = (name: string) => {
  const item = screen.getByText(name).closest('li')
  if (!item) throw new Error(`no row for ${name}`)
  return item
}
const names = (section: HTMLElement) =>
  within(section)
    .getAllByRole('listitem')
    .map((item) => item.querySelector('[data-slot="user-name"]')?.textContent)

describe('UserQueue', () => {
  it('groups users into the four sections, the queue first with its count', () => {
    setup()
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Chờ duyệt (2)', 'Đang hoạt động', 'Tạm khoá', 'Bị từ chối'])
    expect(names(region('Chờ duyệt (2)'))).toEqual(['Chờ Một', 'cho-hai@example.test'])
    expect(names(region('Đang hoạt động'))).toEqual(['Quản trị viên An', 'Admin Khác', 'Học Viên'])
    expect(names(region('Tạm khoá'))).toEqual(['Bị Khoá'])
    expect(names(region('Bị từ chối'))).toEqual(['Bị Loại'])
  })

  it('shows each user’s name, e-mail and sign-up day (Vietnam time)', () => {
    setup()
    const first = rowOf('Chờ Một')
    expect(within(first).getByText('p1@example.test')).toBeTruthy()
    expect(within(first).getByText('Tham gia 4 tháng 2, 2026')).toBeTruthy()
    // No display name: the e-mail is the name, shown once.
    expect(within(rowOf('cho-hai@example.test')).getAllByText('cho-hai@example.test')).toHaveLength(
      1,
    )
  })

  it('marks admins with a badge', () => {
    setup()
    expect(within(rowOf('Admin Khác')).getByText('Quản trị viên')).toBeTruthy()
    expect(within(rowOf('Học Viên')).queryByText('Quản trị viên')).toBeNull()
  })

  it('shows "Bạn" and no actions on the acting admin’s own row (decision 17)', () => {
    setup()
    const own = rowOf('Quản trị viên An')
    expect(within(own).getByText('Bạn')).toBeTruthy()
    expect(within(own).queryAllByRole('button')).toEqual([])
    expect(within(rowOf('Admin Khác')).getAllByRole('button').length).toBeGreaterThan(0)
  })

  it('gives each row a programmatic focus target (focus follows a moved row)', () => {
    setup()
    const target = document.getElementById(userRowId('p1'))
    expect(target?.getAttribute('tabindex')).toBe('-1')
    expect(rowOf('Chờ Một').contains(target)).toBe(true)
  })

  it('renders the empty queue', () => {
    setup(USERS.filter((user) => user.status !== 'pending'))
    const queue = region('Chờ duyệt (0)')
    expect(within(queue).getByText('Không có tài khoản nào chờ duyệt.')).toBeTruthy()
    expect(within(queue).queryByRole('list')).toBeNull()
  })

  it('renders the other empty sections', () => {
    setup([ME])
    expect(within(region('Tạm khoá')).getByText('Không có tài khoản nào bị tạm khoá.')).toBeTruthy()
    expect(
      within(region('Bị từ chối')).getByText('Không có tài khoản nào bị từ chối.'),
    ).toBeTruthy()
  })

  it('passes each row’s id to the actions', async () => {
    const { setUserStatus, user } = setup()
    await user.click(within(rowOf('Chờ Một')).getByRole('button', { name: 'Duyệt' }))
    await waitFor(() => expect(setUserStatus).toHaveBeenCalledWith('p1', 'active'))
  })
})
