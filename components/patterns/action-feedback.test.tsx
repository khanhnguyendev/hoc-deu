import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionStatus, useActionFeedback, type ActionAnswer } from './action-feedback'
import { Section } from './section'

const toasts = vi.hoisted(() => [] as string[])
vi.mock('@/components/ui/toaster', () => ({
  toast: (message: string) => {
    toasts.push(message)
  },
}))

beforeEach(() => {
  toasts.length = 0
})

const SAVE_FAILED = 'Không lưu được thay đổi. Bạn thử lại nhé.'

/** An action the test settles by hand. */
function deferred() {
  let settle: (answer: ActionAnswer) => void = () => {}
  let fail: (error: Error) => void = () => {}
  const action = vi.fn(
    () =>
      new Promise<ActionAnswer>((resolve, reject) => {
        settle = resolve
        fail = reject
      }),
  )
  return { action, settle: (a: ActionAnswer) => settle(a), fail: (e: Error) => fail(e) }
}

type ControlProps = {
  action: () => Promise<ActionAnswer>
  focusTarget?: () => HTMLElement | null
  toastOk?: boolean
}

function Control({ action, focusTarget, toastOk = false }: ControlProps) {
  const feedback = useActionFeedback({ focusTarget })
  return (
    <div>
      <button
        type="button"
        aria-busy={feedback.pending || undefined}
        onClick={() =>
          feedback.run(action, toastOk ? (answer) => (answer.ok ? 'toast' : undefined) : undefined)
        }
      >
        Gửi
      </button>
      <ActionStatus feedback={feedback} />
    </div>
  )
}

/** The page around the control: it re-renders without it when `gone` (a revalidation). */
function Page(props: ControlProps & { gone: boolean }) {
  const { gone, ...control } = props
  return (
    <>
      <Section title="Kế hoạch hôm nay" focusFallback>
        {gone ? <p>Kế hoạch mới</p> : <Control {...control} />}
      </Section>
      <a href="#other">Khác</a>
    </>
  )
}

/** Lets the transition's continuation after `await send()` run inside the same act batch. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('useActionFeedback + ActionStatus (UI I-3)', () => {
  it('is pending while the action runs; a second press meanwhile sends nothing', async () => {
    const { action, settle } = deferred()
    render(<Control action={action} />)
    const send = screen.getByRole('button', { name: 'Gửi' })
    fireEvent.click(send)
    fireEvent.click(send)
    expect(action).toHaveBeenCalledTimes(1)
    expect(send.getAttribute('aria-busy')).toBe('true')
    await act(async () => settle({ ok: true, message: 'Đã thêm.' }))
    expect(send.getAttribute('aria-busy')).toBeNull()
  })

  it('a control that stays: the answer in its own polite region, never also a toast (m-4)', async () => {
    const { action, settle } = deferred()
    const { unmount } = render(<Control action={action} />)
    const region = screen.getByRole('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    fireEvent.click(screen.getByRole('button'))
    expect(region.textContent).toBe('')
    await act(async () => settle({ ok: true, message: 'Đã thêm bài mới vào kế hoạch.' }))
    expect(region.textContent).toBe('Đã thêm bài mới vào kế hoạch.')
    expect(toasts).toEqual([])
    // Leaving the page later says nothing again.
    unmount()
    expect(toasts).toEqual([])
  })

  it('a refusal stays beside the control, which can be pressed again', async () => {
    const { action, settle } = deferred()
    render(<Control action={action} />)
    fireEvent.click(screen.getByRole('button'))
    await act(async () => settle({ ok: false, message: 'Bạn đã học hết bài mới.' }))
    expect(screen.getByRole('status').textContent).toBe('Bạn đã học hết bài mới.')
    fireEvent.click(screen.getByRole('button'))
    expect(action).toHaveBeenCalledTimes(2)
    // React entangles every pending async transition: settle it before the next test.
    await act(async () => settle({ ok: true, message: 'Đã thêm.' }))
  })

  it('a failed request never escapes to the error boundary: the save-failed message instead', async () => {
    const { action, fail } = deferred()
    render(<Control action={action} />)
    fireEvent.click(screen.getByRole('button'))
    await act(async () => fail(new TypeError('Failed to fetch')))
    expect(screen.getByRole('status').textContent).toBe(SAVE_FAILED)
    expect(toasts).toEqual([])
  })

  it('re-announces the same answer (a new node in the region)', async () => {
    const first = deferred()
    render(<Control action={first.action} />)
    fireEvent.click(screen.getByRole('button'))
    await act(async () => first.settle({ ok: false, message: 'Chưa được.' }))
    const before = screen.getByText('Chưa được.')
    fireEvent.click(screen.getByRole('button'))
    await act(async () => first.settle({ ok: false, message: 'Chưa được.' }))
    expect(screen.getByText('Chưa được.')).not.toBe(before)
  })

  it('a control the answer’s re-render removes: a toast instead, and focus on the page’s fallback', async () => {
    const { action, settle } = deferred()
    const { rerender } = render(<Page action={action} gone={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Gửi' }))
    await act(async () => {
      settle({ ok: false, message: 'Kế hoạch vừa thay đổi. Trang đã được làm mới.' })
      await tick()
      rerender(<Page action={action} gone />)
    })
    expect(screen.queryByRole('button', { name: 'Gửi' })).toBeNull()
    expect(toasts).toEqual(['Kế hoạch vừa thay đổi. Trang đã được làm mới.'])
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Kế hoạch hôm nay' }))
  })

  it('the control’s own focus target first (e.g. the block’s new "Sửa")', async () => {
    const { action, settle } = deferred()
    const target = () => document.querySelector<HTMLElement>('a[href="#other"]')
    const { rerender } = render(<Page action={action} focusTarget={target} gone={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Gửi' }))
    await act(async () => {
      settle({ ok: true, message: 'Đã check-in: xong khối học.' })
      await tick()
      rerender(<Page action={action} focusTarget={target} gone />)
    })
    expect(toasts).toEqual(['Đã check-in: xong khối học.'])
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Khác' }))
  })

  it('never moves focus that is still somewhere', async () => {
    const { action, settle } = deferred()
    const { rerender } = render(<Page action={action} gone={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Gửi' }))
    const other = screen.getByRole('link', { name: 'Khác' })
    other.focus()
    await act(async () => {
      settle({ ok: true, message: 'Đã xong.' })
      await tick()
      rerender(<Page action={action} gone />)
    })
    expect(toasts).toEqual(['Đã xong.'])
    expect(document.activeElement).toBe(other)
  })

  it('a control whose answer was shown, removed later with focus lost: focus moves, no toast', async () => {
    const { action, settle } = deferred()
    const { rerender } = render(<Page action={action} gone={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Gửi' }))
    await act(async () => settle({ ok: true, message: 'Đã xong.' }))
    expect(screen.getByRole('status').textContent).toBe('Đã xong.')
    rerender(<Page action={action} gone />)
    expect(toasts).toEqual([])
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Kế hoạch hôm nay' }))
  })

  it('a control never used moves no focus when it goes', () => {
    const { rerender } = render(<Page action={deferred().action} gone={false} />)
    rerender(<Page action={deferred().action} gone />)
    expect(document.activeElement).toBe(document.body)
  })

  it('an answer the caller delivers as a toast is not in the region', async () => {
    const { action, settle } = deferred()
    render(<Control action={action} toastOk />)
    fireEvent.click(screen.getByRole('button'))
    await act(async () => settle({ ok: true, message: 'Đã check-in.' }))
    expect(toasts).toEqual(['Đã check-in.'])
    expect(screen.getByRole('status').textContent).toBe('')
  })
})

describe('Section — focusFallback', () => {
  it('marks its heading as the page’s focus fallback, focusable by script only', () => {
    function Two() {
      const [n] = useState(0)
      return (
        <>
          <Section title="A" focusFallback>
            {n}
          </Section>
          <Section title="B">{n}</Section>
        </>
      )
    }
    render(<Two />)
    const a = screen.getByRole('heading', { name: 'A' })
    expect(a.getAttribute('tabindex')).toBe('-1')
    expect(a.hasAttribute('data-focus-fallback')).toBe(true)
    const b = screen.getByRole('heading', { name: 'B' })
    expect(b.hasAttribute('tabindex')).toBe(false)
    expect(b.hasAttribute('data-focus-fallback')).toBe(false)
  })
})
