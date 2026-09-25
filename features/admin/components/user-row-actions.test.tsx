import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi as mock } from 'vitest'
import type { AccountStatus, Role } from '@/lib/auth/dal'
import { Toaster } from '@/components/ui/toaster'
import type { AdminActionResult } from '../actions'
import { userRowId } from './user-row-id'
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

/**
 * Every focus move during a test lands on an element of that test. A dialog still open when a test
 * ends closes on cleanup, and Radix hands focus back to its opener a macrotask later: without the
 * flush below, that landed inside the next test, on a detached button, at a moment set by the load
 * (the "Duyệt" focus test failed once in 3.9a).
 */
const strayFocus: string[] = []
beforeEach(() => {
  strayFocus.length = 0
  const focus = HTMLElement.prototype.focus
  mock.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
    this: HTMLElement,
    options,
  ) {
    if (!this.isConnected) strayFocus.push(`${this.tagName} "${this.textContent ?? ''}"`)
    focus.call(this, options)
  })
})
afterEach(async () => {
  const stray = [...strayFocus]
  mock.restoreAllMocks()
  // Unmount here (the setup file's cleanup then has nothing left) and let Radix's close-focus timer
  // run inside this test.
  cleanup()
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(stray, 'focus moved to an element no longer in the document').toEqual([])
})

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

describe('UserRowActions — a name is shown as written', () => {
  it('keeps "$&" and friends literal in the labels (String.replace patterns)', async () => {
    const name = "An $& $` $' $$"
    const user = userEvent.setup()
    render(
      <UserRowActions
        user={{ id: ID, name, status: 'active', role: 'learner' }}
        setUserStatus={async () => ({ ok: true, message: 'x' })}
        setUserRole={async () => ({ ok: true, message: 'x' })}
      />,
    )
    expect(screen.getByRole('group', { name: `Thao tác với ${name}` })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Tạm khoá' }))
    expect(
      await screen.findByRole('alertdialog', { name: `Tạm khoá tài khoản của ${name}?` }),
    ).toBeTruthy()
  })
})

describe('UserRowActions — keyboard focus follows the row (WCAG 2.4.3)', () => {
  type RowProps = {
    status: AccountStatus
    role?: Role
    result?: AdminActionResult
  }

  /** The row as UserQueue renders it: the focus target (row id, tabIndex -1) around the actions. */
  function Row({ status, role = 'learner', result = { ok: true, message: 'Xong.' } }: RowProps) {
    return (
      <div id={userRowId(ID)} tabIndex={-1} data-testid="row">
        <UserRowActions
          user={{ id: ID, name: NAME, status, role }}
          setUserStatus={async () => result}
          setUserRole={async () => result}
        />
      </div>
    )
  }

  it('focuses the row in its new section after "Duyệt" moved it', async () => {
    const user = userEvent.setup()
    // A different key remounts the row, as moving it to another Section does.
    const { rerender } = render(<Row key="pending" status="pending" />)
    await user.click(screen.getByRole('button', { name: 'Duyệt' }))
    rerender(<Row key="active" status="active" />)
    // The new row's effect runs inside rerender's act: focus is there at once, nothing to wait for.
    expect(document.activeElement).toBe(screen.getByTestId('row'))
  })

  it('focuses the row after a confirmed "Tạm khoá" moved it', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Row key="active" status="active" />)
    await user.click(screen.getByRole('button', { name: 'Tạm khoá' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Tạm khoá' }))
    rerender(<Row key="suspended" status="suspended" />)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('row')))
  })

  it('focuses the row after a confirmed role change that keeps it in place', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Row key="active" status="active" />)
    const roleButton = screen.getByRole('button', { name: 'Đặt làm quản trị' })
    await user.click(roleButton)
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Đặt làm quản trị' }))
    rerender(<Row key="active" status="active" role="admin" />)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('row')))
    // The role button is keyed by its slot, so the same element now offers the way back.
    expect(screen.getByRole('button', { name: 'Bỏ quyền quản trị' })).toBe(roleButton)
  })

  it('returns focus to the button when the dialog is cancelled', async () => {
    const user = userEvent.setup()
    render(<Row status="active" />)
    const trigger = screen.getByRole('button', { name: 'Tạm khoá' })
    await user.click(trigger)
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Huỷ' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('returns focus to the button after a failed confirmed action', async () => {
    const user = userEvent.setup()
    render(<Row status="pending" result={{ ok: false, message: 'Không được.' }} />)
    const trigger = screen.getByRole('button', { name: 'Từ chối' })
    await user.click(trigger)
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Từ chối' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('focuses the row when a failed action re-renders it in another state (a stale list)', async () => {
    const user = userEvent.setup()
    const failed: AdminActionResult = { ok: false, message: 'Đã đổi.' }
    const { rerender } = render(<Row key="pending" status="pending" result={failed} />)
    await user.click(screen.getByRole('button', { name: 'Duyệt' }))
    await screen.findAllByText('Đã đổi.')
    // Another admin had rejected the account; the revalidated list shows it there.
    rerender(<Row key="rejected" status="rejected" result={failed} />)
    expect(document.activeElement).toBe(screen.getByTestId('row'))
  })
})
