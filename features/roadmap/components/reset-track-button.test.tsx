import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ResetTrackButton } from './reset-track-button'

const toasts = vi.hoisted(() => [] as string[])
vi.mock('@/components/ui/toaster', () => ({
  toast: (message: string) => {
    toasts.push(message)
  },
}))

const REQUEST_ID = 'c0ffee00-1234-4abc-8def-0123456789ab'
type Result = { ok: boolean; message: string }

beforeEach(() => {
  toasts.length = 0
})

/** An action the test settles by hand. */
function deferred() {
  let settle: (result: Result) => void = () => {}
  const action = vi.fn<(input: { requestId: string; trackId: string }) => Promise<Result>>(
    () =>
      new Promise<Result>((resolve) => {
        settle = resolve
      }),
  )
  return { action, settle: (result: Result) => settle(result) }
}

describe('ResetTrackButton ("Bắt đầu lại", §5.9)', () => {
  it('asks first in an alert dialog; cancelling sends nothing and returns focus', async () => {
    const user = userEvent.setup()
    const { action } = deferred()
    render(<ResetTrackButton action={action} requestId={REQUEST_ID} trackId="dsa" />)
    const button = screen.getByRole('button', { name: 'Bắt đầu lại' })
    await user.click(button)
    const dialog = screen.getByRole('alertdialog', { name: 'Xoá tiến độ của lộ trình này?' })
    expect(dialog.textContent).toContain('Lịch sử học và chuỗi ngày vẫn được giữ.')
    await user.click(screen.getByRole('button', { name: 'Huỷ' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(action).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(button)
  })

  it('confirming sends the render’s request id and the track, then announces the answer', async () => {
    const user = userEvent.setup()
    const { action, settle } = deferred()
    render(<ResetTrackButton action={action} requestId={REQUEST_ID} trackId="dsa" />)
    await user.click(screen.getByRole('button', { name: 'Bắt đầu lại' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(
      [...dialog.querySelectorAll('button')].find((b) => b.textContent === 'Bắt đầu lại')!,
    )
    expect(action).toHaveBeenCalledExactlyOnceWith({ requestId: REQUEST_ID, trackId: 'dsa' })
    // Busy while it runs: the dialog stays open.
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    const message = 'Đã bắt đầu lại lộ trình Cấu trúc dữ liệu & Giải thuật.'
    await act(async () => settle({ ok: true, message }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toBe(message)
    expect(toasts).toEqual([message])
  })

  it('keeps a failure next to the button (never a toast alone)', async () => {
    const user = userEvent.setup()
    const { action, settle } = deferred()
    render(<ResetTrackButton action={action} requestId={REQUEST_ID} trackId="dsa" />)
    await user.click(screen.getByRole('button', { name: 'Bắt đầu lại' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(
      [...dialog.querySelectorAll('button')].find((b) => b.textContent === 'Bắt đầu lại')!,
    )
    const message = 'Lộ trình đang ở trạng thái khác. Bạn tải lại trang nhé.'
    await act(async () => settle({ ok: false, message }))
    expect(screen.getByRole('status').textContent).toBe(message)
    expect(toasts).toEqual([])
  })
})
