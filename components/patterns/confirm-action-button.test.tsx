import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Trash2 } from 'lucide-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PageHeader } from './page-header'
import { ConfirmActionButton } from './confirm-action-button'

const toasts = vi.hoisted(() => [] as string[])
vi.mock('@/components/ui/toaster', () => ({
  toast: (message: string) => {
    toasts.push(message)
  },
}))

type Result = { ok: boolean; message: string }

beforeEach(() => {
  toasts.length = 0
})

/** An action the test settles by hand. */
function deferred() {
  let settle: (result: Result) => void = () => {}
  const send = vi.fn(
    () =>
      new Promise<Result>((resolve) => {
        settle = resolve
      }),
  )
  return { send, settle: (result: Result) => settle(result) }
}

const DIALOG = { title: 'Xoá mục này?', description: 'Không hoàn tác được.', confirm: 'Xoá' }

function button(
  send: () => Promise<Result>,
  extra: { tone?: 'destructive'; ariaLabel?: string } = {},
) {
  return <ConfirmActionButton icon={Trash2} label="Xoá" dialog={DIALOG} send={send} {...extra} />
}

async function confirmIn(user: ReturnType<typeof userEvent.setup>) {
  const dialog = screen.getByRole('alertdialog', { name: DIALOG.title })
  await user.click(within(dialog).getByRole('button', { name: DIALOG.confirm }))
}

describe('ConfirmActionButton', () => {
  it('an outline button with its icon hidden; the aria-label, when given, names it', () => {
    const { rerender } = render(button(vi.fn()))
    const plain = screen.getByRole('button', { name: 'Xoá' })
    expect(plain.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    rerender(button(vi.fn(), { ariaLabel: 'Xoá: Two Sum' }))
    expect(screen.getByRole('button', { name: 'Xoá: Two Sum' })).toBeTruthy()
    // The status region is always there, empty until an answer.
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('asks first; cancelling sends nothing and returns focus to the button', async () => {
    const user = userEvent.setup()
    const { send } = deferred()
    render(button(send))
    const trigger = screen.getByRole('button', { name: 'Xoá' })
    await user.click(trigger)
    const dialog = screen.getByRole('alertdialog', { name: DIALOG.title })
    expect(dialog.textContent).toContain(DIALOG.description)
    await user.click(within(dialog).getByRole('button', { name: 'Huỷ' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(send).not.toHaveBeenCalled()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('tone="destructive" makes the confirm button the destructive one', async () => {
    const user = userEvent.setup()
    render(button(deferred().send, { tone: 'destructive' }))
    await user.click(screen.getByRole('button', { name: 'Xoá' }))
    const confirm = within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Xoá' })
    expect(confirm.getAttribute('data-variant')).toBe('destructive')
  })

  it('pending: the dialog stays open and busy; then it closes and the region says the answer', async () => {
    const user = userEvent.setup()
    const { send, settle } = deferred()
    render(button(send))
    await user.click(screen.getByRole('button', { name: 'Xoá' }))
    await confirmIn(user)
    expect(send).toHaveBeenCalledOnce()
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByRole('button', { name: 'Huỷ' })).toHaveProperty('disabled', true)
    await act(async () => settle({ ok: true, message: 'Đã xoá.' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Đã xoá.'))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(toasts).toEqual([])
  })

  it('a refusal stays beside the button (never a toast alone)', async () => {
    const user = userEvent.setup()
    const { send, settle } = deferred()
    render(button(send))
    await user.click(screen.getByRole('button', { name: 'Xoá' }))
    await confirmIn(user)
    await act(async () => settle({ ok: false, message: 'Không xoá được.' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Không xoá được.'))
    expect(toasts).toEqual([])
  })

  it('a failed request says so beside the button — never the error boundary', async () => {
    const user = userEvent.setup()
    render(button(() => Promise.reject(new TypeError('Failed to fetch'))))
    await user.click(screen.getByRole('button', { name: 'Xoá' }))
    await confirmIn(user)
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        'Không lưu được thay đổi. Bạn thử lại nhé.',
      ),
    )
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('removed by the answer’s re-render: a toast, and focus on the page’s h1', async () => {
    const user = userEvent.setup()
    const { send, settle } = deferred()
    const page = (shown: boolean) => (
      <>
        <PageHeader title="Trang mẫu" />
        {shown && button(send)}
      </>
    )
    const { rerender } = render(page(true))
    await user.click(screen.getByRole('button', { name: 'Xoá' }))
    await confirmIn(user)
    await act(async () => {
      settle({ ok: true, message: 'Đã xoá.' })
      await new Promise((resolve) => setTimeout(resolve, 0))
      rerender(page(false))
    })
    expect(toasts).toEqual(['Đã xoá.'])
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })),
    )
  })
})
