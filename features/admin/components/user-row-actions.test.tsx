import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi as mock } from 'vitest'
import type { AccountStatus, Role } from '@/lib/auth/dal'
import { Toaster } from '@/components/ui/toaster'
import type { AdminActionResult } from '../actions'
import { UserRowActions } from './user-row-actions'

const ID = '5b0c61a2-7f5e-4c3b-9a41-2f1d7c8e9a10'
const NAME = 'Trần Thị Bình'

type StatusTarget = 'active' | 'rejected' | 'suspended'

// Sonner keeps its toasts in module state across tests, so every test toasts its own message.
let run = 0
let done = ''

function setup(status: AccountStatus, role: Role = 'learner', result?: AdminActionResult) {
  run += 1
  done = `Đã xong (${run}).`
  const ok: AdminActionResult = result ?? { ok: true, message: done }
  const setUserStatus = mock.fn<(id: string, status: StatusTarget) => Promise<AdminActionResult>>(
    async () => ok,
  )
  const setUserRole = mock.fn<(id: string, role: Role) => Promise<AdminActionResult>>(
    async () => ok,
  )
  render(
    <>
      <UserRowActions
        user={{ id: ID, name: NAME, status, role }}
        setUserStatus={setUserStatus}
        setUserRole={setUserRole}
      />
      <Toaster />
    </>,
  )
  return { setUserStatus, setUserRole, user: userEvent.setup() }
}

const group = () => screen.getByRole('group', { name: `Thao tác với ${NAME}` })
const buttonNames = () =>
  within(group())
    .getAllByRole('button')
    .map((button) => button.textContent)

describe('UserRowActions — the buttons per status (decision 17)', () => {
  it.each([
    ['pending', 'learner', ['Duyệt', 'Từ chối']],
    ['active', 'learner', ['Tạm khoá', 'Đặt làm quản trị']],
    ['active', 'admin', ['Tạm khoá', 'Bỏ quyền quản trị']],
    ['suspended', 'learner', ['Kích hoạt lại']],
    ['rejected', 'learner', ['Kích hoạt lại']],
  ] as const)('%s %s: %j', (status, role, expected) => {
    setup(status, role)
    expect(buttonNames()).toEqual(expected)
  })
})

describe('UserRowActions — immediate actions', () => {
  it('"Duyệt" approves at once (no dialog) and toasts the result', async () => {
    const { setUserStatus, setUserRole, user } = setup('pending')
    await user.click(screen.getByRole('button', { name: 'Duyệt' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await waitFor(() => expect(setUserStatus).toHaveBeenCalledWith(ID, 'active'))
    expect(setUserStatus).toHaveBeenCalledTimes(1)
    expect(setUserRole).not.toHaveBeenCalled()
    expect(await screen.findByText(done)).toBeTruthy()
  })

  it.each(['suspended', 'rejected'] as const)(
    '"Kích hoạt lại" reactivates a %s account at once',
    async (status) => {
      const { setUserStatus, user } = setup(status)
      await user.click(screen.getByRole('button', { name: 'Kích hoạt lại' }))
      expect(screen.queryByRole('alertdialog')).toBeNull()
      await waitFor(() => expect(setUserStatus).toHaveBeenCalledWith(ID, 'active'))
    },
  )
})

describe('UserRowActions — confirmed actions', () => {
  it.each([
    ['pending', 'learner', 'Từ chối', `Từ chối tài khoản của ${NAME}?`, 'status', 'rejected'],
    ['active', 'learner', 'Tạm khoá', `Tạm khoá tài khoản của ${NAME}?`, 'status', 'suspended'],
    ['active', 'learner', 'Đặt làm quản trị', `Đặt ${NAME} làm quản trị viên?`, 'role', 'admin'],
    ['active', 'admin', 'Bỏ quyền quản trị', `Bỏ quyền quản trị của ${NAME}?`, 'role', 'learner'],
  ] as const)(
    '%s %s: "%s" asks "%s" first, then calls the action',
    async (status, role, button, title, kind, target) => {
      const { setUserStatus, setUserRole, user } = setup(status, role)
      await user.click(within(group()).getByRole('button', { name: button }))

      const dialog = await screen.findByRole('alertdialog', { name: title })
      expect(setUserStatus).not.toHaveBeenCalled()
      expect(setUserRole).not.toHaveBeenCalled()

      await user.click(within(dialog).getByRole('button', { name: button }))
      const action = kind === 'status' ? setUserStatus : setUserRole
      const other = kind === 'status' ? setUserRole : setUserStatus
      await waitFor(() => expect(action).toHaveBeenCalledWith(ID, target))
      expect(action).toHaveBeenCalledTimes(1)
      expect(other).not.toHaveBeenCalled()
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      expect(await screen.findByText(done)).toBeTruthy()
    },
  )

  it('"Huỷ" closes the dialog without calling the action', async () => {
    const { setUserStatus, user } = setup('active')
    await user.click(screen.getByRole('button', { name: 'Tạm khoá' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Huỷ' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(setUserStatus).not.toHaveBeenCalled()
  })
})

describe('UserRowActions — a failed action', () => {
  it('shows the message in the row as well as in a toast (never toast-only)', async () => {
    const message = 'Tài khoản đã đổi trạng thái (lỗi thử).'
    const { user } = setup('pending', 'learner', { ok: false, message })
    await user.click(screen.getByRole('button', { name: 'Duyệt' }))
    await waitFor(() => expect(screen.getAllByText(message)).toHaveLength(2))
    const inline = screen
      .getAllByText(message)
      .find((element) => group().parentElement?.contains(element))
    expect(inline).toBeTruthy()
  })
})
