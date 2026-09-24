import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PendingStatus, SignOutButton } from './pending-status'

describe('PendingStatus', () => {
  it('shows the pending copy, including that the page moves on by itself', () => {
    render(<PendingStatus status="pending" />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Tài khoản của bạn đang chờ duyệt' }),
    ).toBeTruthy()
    expect(
      screen.getByText('Quản trị viên sẽ duyệt sớm. Trang này tự chuyển khi tài khoản được duyệt.'),
    ).toBeTruthy()
  })

  it('shows the rejected copy', () => {
    render(<PendingStatus status="rejected" />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Tài khoản chưa được duyệt' }),
    ).toBeTruthy()
  })

  it('shows the suspended copy', () => {
    render(<PendingStatus status="suspended" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Tài khoản đang tạm khoá' })).toBeTruthy()
  })
})

describe('SignOutButton', () => {
  it('is a submit button that runs the sign-out action', async () => {
    const signOut = vi.fn<() => Promise<void>>(async () => {})
    render(<SignOutButton signOut={signOut} />)
    const button = screen.getByRole('button', { name: 'Đăng xuất' })
    expect(button.getAttribute('type')).toBe('submit')
    await userEvent.setup().click(button)
    expect(signOut).toHaveBeenCalledTimes(1)
  })
})
