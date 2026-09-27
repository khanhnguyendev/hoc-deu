import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExtraResult } from '../actions'
import type { ExtraView } from '../view-model'
import { DSA_TITLE, ENGLISH_TITLE, REQUEST_ID } from '../__tests__/fixtures'
import { ExtraButton } from './extra-button'

const toasts = vi.hoisted(() => [] as string[])
vi.mock('@/components/ui/toaster', () => ({
  toast: (message: string) => {
    toasts.push(message)
  },
}))

beforeEach(() => {
  toasts.length = 0
})

const DSA: ExtraView = {
  trackId: 'dsa',
  trackTitle: DSA_TITLE,
  accent: 'track-1',
  newPaused: false,
}

/** An action the test settles by hand. */
function deferred() {
  let settle: (result: ExtraResult) => void = () => {}
  const action = vi.fn<(input: { requestId: string; trackId: string }) => Promise<ExtraResult>>(
    () =>
      new Promise<ExtraResult>((resolve) => {
        settle = resolve
      }),
  )
  return { action, settle: (result: ExtraResult) => settle(result) }
}

describe('ExtraButton ("Học thêm", decision 20)', () => {
  it('names the track, sends the render’s request id and the track, once for a double click', async () => {
    const { action, settle } = deferred()
    render(<ExtraButton view={DSA} requestId={REQUEST_ID} action={action} />)
    const button = screen.getByRole('button', { name: `Học thêm ${DSA_TITLE}` })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(action).toHaveBeenCalledExactlyOnceWith({ requestId: REQUEST_ID, trackId: 'dsa' })
    expect(button.getAttribute('aria-busy')).toBe('true')
    await act(async () => settle({ ok: true, message: 'Đã thêm bài mới vào kế hoạch.' }))
    expect(button.getAttribute('aria-busy')).toBeNull()
  })

  it('announces a success in its polite live region only — the button stays, so no toast (m-4)', async () => {
    const { action, settle } = deferred()
    render(<ExtraButton view={DSA} requestId={REQUEST_ID} action={action} />)
    const region = screen.getByRole('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    fireEvent.click(screen.getByRole('button'))
    await act(async () => settle({ ok: true, message: 'Đã thêm bài mới vào kế hoạch.' }))
    expect(region.textContent).toBe('Đã thêm bài mới vào kế hoạch.')
    expect(toasts).toEqual([])
  })

  it('a failed request (a flaky network) stays beside the button — never the error boundary', async () => {
    const action = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
    render(<ExtraButton view={DSA} requestId={REQUEST_ID} action={action} />)
    await act(async () => fireEvent.click(screen.getByRole('button')))
    expect(screen.getByRole('status').textContent).toBe('Không lưu được thay đổi. Bạn thử lại nhé.')
    expect(toasts).toEqual([])
  })

  it('keeps "nothing to add" next to the button, never a toast alone', async () => {
    const { action, settle } = deferred()
    render(<ExtraButton view={DSA} requestId={REQUEST_ID} action={action} />)
    fireEvent.click(screen.getByRole('button'))
    const message = 'Bạn đã học hết bài mới của lộ trình này.'
    await act(async () => settle({ ok: false, message }))
    expect(screen.getByRole('status').textContent).toBe(message)
    expect(toasts).toEqual([])
  })

  it('new items paused (throttled to 0, §5.5): one line, no button, no second reason or link (UI I-5)', () => {
    const action = vi.fn()
    render(
      <ExtraButton
        view={{
          trackId: 'english',
          trackTitle: ENGLISH_TITLE,
          accent: 'track-2',
          newPaused: true,
        }}
        requestId={REQUEST_ID}
        action={action}
      />,
    )
    expect(screen.queryByRole('button')).toBeNull()
    // The throttle banner above says why and links the reviews: the card never repeats them.
    expect(screen.getByText('Hôm nay tạm dừng bài mới.')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
    expect(document.body.textContent).not.toMatch(/cần ôn/)
    expect(action).not.toHaveBeenCalled()
  })

  it('sits in its track’s accent, with the track chip (never colour alone)', () => {
    const { container } = render(<ExtraButton view={DSA} requestId={REQUEST_ID} action={vi.fn()} />)
    const root = container.querySelector('[data-slot="extra-button"]')
    expect(root?.getAttribute('data-accent')).toBe('track-1')
    expect(screen.getByText(DSA_TITLE, { selector: '[data-slot="badge"]' })).toBeTruthy()
  })
})
