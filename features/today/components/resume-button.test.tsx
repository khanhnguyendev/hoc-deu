import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResumeResult } from '../actions'
import { ResumeButton } from './resume-button'

const toasts = vi.hoisted(() => [] as string[])
vi.mock('@/components/ui/toaster', () => ({
  toast: (message: string) => {
    toasts.push(message)
  },
}))

beforeEach(() => {
  toasts.length = 0
})

/** An action the test settles by hand. */
function deferred() {
  let settle: (result: ResumeResult) => void = () => {}
  const action = vi.fn(
    () =>
      new Promise<ResumeResult>((resolve) => {
        settle = resolve
      }),
  )
  return { action, settle: (result: ResumeResult) => settle(result) }
}

describe('ResumeButton (§5.8)', () => {
  it('"Học tiếp hôm nay": pending while the action runs, one call for a double click', async () => {
    const { action, settle } = deferred()
    render(<ResumeButton resume={action} />)
    const button = screen.getByRole('button', { name: 'Học tiếp hôm nay' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(action).toHaveBeenCalledTimes(1)
    expect(button.getAttribute('aria-busy')).toBe('true')
    await act(async () =>
      settle({ ok: true, message: 'Đã tạo kế hoạch hôm nay từ phần học còn dang dở.' }),
    )
    expect(button.getAttribute('aria-busy')).toBeNull()
  })

  it('announces the result in a polite live region; a success is also a toast', async () => {
    const { action, settle } = deferred()
    render(<ResumeButton resume={action} />)
    const region = screen.getByRole('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(region.textContent).toBe('')
    fireEvent.click(screen.getByRole('button'))
    await act(async () => settle({ ok: true, message: 'Kế hoạch hôm nay đã được tạo.' }))
    expect(region.textContent).toBe('Kế hoạch hôm nay đã được tạo.')
    expect(toasts).toEqual(['Kế hoạch hôm nay đã được tạo.'])
  })

  it('keeps a failure next to the button (never a toast alone)', async () => {
    const { action, settle } = deferred()
    render(<ResumeButton resume={action} />)
    fireEvent.click(screen.getByRole('button'))
    const message = 'Lựa chọn này không còn khả dụng. Trang đã được làm mới.'
    await act(async () => settle({ ok: false, message }))
    expect(screen.getByRole('status').textContent).toBe(message)
    expect(toasts).toEqual([])
  })
})
