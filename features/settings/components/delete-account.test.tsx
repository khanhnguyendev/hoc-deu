import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SettingsAction, SettingsResult } from '../schema'
import { DeleteAccount } from './delete-account'

function setup(result?: SettingsResult) {
  const deleteAccount = vi.fn<SettingsAction>(async () => result ?? { ok: true, message: '' })
  render(<DeleteAccount deleteAccount={deleteAccount} />)
  return { deleteAccount, user: userEvent.setup() }
}

describe('DeleteAccount', () => {
  it('states the backup-retention notice', () => {
    setup()
    expect(
      screen.getByText(
        'Dữ liệu đã xoá vẫn có thể tồn tại trong bản sao lưu đã mã hoá tối đa 90 ngày.',
      ),
    ).toBeTruthy()
  })

  it('"Xoá vĩnh viễn" asks first: the action runs only after confirming', async () => {
    const { deleteAccount, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Xoá vĩnh viễn' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Xoá tài khoản vĩnh viễn?' })
    expect(deleteAccount).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Xoá vĩnh viễn' }))
    await waitFor(() => expect(deleteAccount).toHaveBeenCalledTimes(1))
  })

  it('"Huỷ" closes the dialog without deleting', async () => {
    const { deleteAccount, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Xoá vĩnh viễn' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Huỷ' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(deleteAccount).not.toHaveBeenCalled()
  })

  it('a failure closes the dialog and shows the message in an alert', async () => {
    const { user } = setup({ ok: false, message: 'Không xoá được tài khoản. Bạn thử lại nhé.' })
    await user.click(screen.getByRole('button', { name: 'Xoá vĩnh viễn' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Xoá vĩnh viễn' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByRole('alert').textContent).toContain(
      'Không xoá được tài khoản. Bạn thử lại nhé.',
    )
  })
})
