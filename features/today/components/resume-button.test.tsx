import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Section } from '@/components/patterns/section'
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

const STALE = 'Kế hoạch vừa thay đổi. Trang đã được làm mới.'

/** `/today` around the button: the paused view, or — after the re-render — today's plan. */
function Paused({ resume, resumed }: { resume: () => Promise<ResumeResult>; resumed: boolean }) {
  return (
    <>
      {!resumed && <ResumeButton resume={resume} />}
      <Section title={resumed ? 'Kế hoạch hôm nay' : 'Phần còn dang dở'} focusFallback>
        <p>…</p>
      </Section>
    </>
  )
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

  it('the re-render replaces the paused view: the answer is a toast, focus on the plan heading', async () => {
    const { action, settle } = deferred()
    const { rerender } = render(<Paused resume={action} resumed={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Học tiếp hôm nay' }))
    await act(async () => {
      settle({ ok: true, message: 'Đã tạo kế hoạch hôm nay từ phần học còn dang dở.' })
      await new Promise((resolve) => setTimeout(resolve, 0))
      rerender(<Paused resume={action} resumed />)
    })
    expect(toasts).toEqual(['Đã tạo kế hoạch hôm nay từ phần học còn dang dở.'])
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Kế hoạch hôm nay' }))
  })

  it('while the button stays, the answer is in its polite region only', async () => {
    const { action, settle } = deferred()
    render(<ResumeButton resume={action} />)
    const region = screen.getByRole('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(region.textContent).toBe('')
    fireEvent.click(screen.getByRole('button'))
    await act(async () => settle({ ok: false, message: STALE }))
    expect(region.textContent).toBe(STALE)
    expect(toasts).toEqual([])
  })

  it('a failed request says the save failed beside the button — never the error boundary', async () => {
    const action = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
    render(<ResumeButton resume={action} />)
    await act(async () => fireEvent.click(screen.getByRole('button')))
    expect(screen.getByRole('status').textContent).toBe('Không lưu được thay đổi. Bạn thử lại nhé.')
    expect(toasts).toEqual([])
  })
})
