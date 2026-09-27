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
  throttledDue: null,
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

  it('announces a success in its polite live region and as a toast', async () => {
    const { action, settle } = deferred()
    render(<ExtraButton view={DSA} requestId={REQUEST_ID} action={action} />)
    const region = screen.getByRole('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    fireEvent.click(screen.getByRole('button'))
    await act(async () => settle({ ok: true, message: 'Đã thêm bài mới vào kế hoạch.' }))
    expect(region.textContent).toBe('Đã thêm bài mới vào kế hoạch.')
    expect(toasts).toEqual(['Đã thêm bài mới vào kế hoạch.'])
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

  it('throttled to 0 new items: says why, links to /review, and offers no button (§5.5)', () => {
    const action = vi.fn()
    render(
      <ExtraButton
        view={{
          trackId: 'english',
          trackTitle: ENGLISH_TITLE,
          accent: 'track-2',
          throttledDue: 61,
        }}
        requestId={REQUEST_ID}
        action={action}
      />,
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(
      screen.getByText(
        'Kế hoạch này được lập khi bạn có 61 thẻ cần ôn, nên hôm nay tạm dừng bài mới. Bạn vẫn có thể ôn tập.',
      ),
    ).toBeTruthy()
    const link = screen.getByRole('link', { name: `Ôn tập ${ENGLISH_TITLE}` })
    expect(link.getAttribute('href')).toBe('/review?track=english')
    expect(action).not.toHaveBeenCalled()
  })

  it('sits in its track’s accent, with the track chip (never colour alone)', () => {
    const { container } = render(<ExtraButton view={DSA} requestId={REQUEST_ID} action={vi.fn()} />)
    const root = container.querySelector('[data-slot="extra-button"]')
    expect(root?.getAttribute('data-accent')).toBe('track-1')
    expect(screen.getByText(DSA_TITLE, { selector: '[data-slot="badge"]' })).toBeTruthy()
  })
})
