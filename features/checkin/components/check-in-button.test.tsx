import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CheckInResult } from '../actions'
import type { CheckInInput } from '../schema'
import { CheckInButton } from './check-in-button'

const toasts = vi.hoisted(() => [] as string[])
vi.mock('@/components/ui/toaster', () => ({
  toast: (message: string) => {
    toasts.push(message)
  },
}))

beforeEach(() => {
  toasts.length = 0
})

const REQUEST_ID = 'c0ffee00-1234-4abc-8def-0123456789ab'
const PLAN_ID = '9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f'
const BLOCK_ID = '2026-09-28:dsa:new:1'
const LABEL = 'Bài mới · Cấu trúc dữ liệu & Giải thuật'

/** An action the test settles by hand. */
function deferred() {
  let settle: (result: CheckInResult) => void = () => {}
  let fail: (error: Error) => void = () => {}
  const action = vi.fn<(input: CheckInInput) => Promise<CheckInResult>>(
    () =>
      new Promise<CheckInResult>((resolve, reject) => {
        settle = resolve
        fail = reject
      }),
  )
  return {
    action,
    settle: (result: CheckInResult) => settle(result),
    fail: (error: Error) => fail(error),
  }
}

function button(action: (input: CheckInInput) => Promise<CheckInResult>) {
  return render(
    <CheckInButton
      action={action}
      requestId={REQUEST_ID}
      planId={PLAN_ID}
      blockId={BLOCK_ID}
      blockLabel={LABEL}
    />,
  )
}

describe('CheckInButton (DESIGN_SYSTEM §9: one-tap)', () => {
  it('is the full-width 48 px primary "Check-in", named with its block', () => {
    button(deferred().action)
    const tap = screen.getByRole('button', { name: `Check-in: ${LABEL}` })
    expect(tap.getAttribute('data-variant')).toBe('primary')
    expect(tap.getAttribute('data-size')).toBe('lg')
    expect(tap.className).toContain('w-full')
  })

  it('checks the block in "done" with the pre-filled minutes: no minutes, the page’s ids', async () => {
    const { action, settle } = deferred()
    button(action)
    fireEvent.click(screen.getByRole('button'))
    expect(action.mock.calls).toEqual([
      [{ requestId: REQUEST_ID, planId: PLAN_ID, blockId: BLOCK_ID, status: 'done' }],
    ])
    await act(async () => settle({ ok: true, message: 'Đã check-in: xong khối học.' }))
  })

  it('is pending while the action runs; a double click sends one check-in (RF-2)', async () => {
    const { action, settle } = deferred()
    button(action)
    const tap = screen.getByRole('button')
    fireEvent.click(tap)
    fireEvent.click(tap)
    expect(action).toHaveBeenCalledTimes(1)
    expect(tap.getAttribute('aria-busy')).toBe('true')
    await act(async () => settle({ ok: true, message: 'Đã check-in: xong khối học.' }))
    expect(tap.getAttribute('aria-busy')).toBeNull()
  })

  it('announces the result in a polite live region; a success is also a toast', async () => {
    const { action, settle } = deferred()
    button(action)
    const region = screen.getByRole('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(region.textContent).toBe('')
    fireEvent.click(screen.getByRole('button'))
    await act(async () => settle({ ok: true, message: 'Đã check-in: xong khối học.' }))
    expect(region.textContent).toBe('Đã check-in: xong khối học.')
    expect(toasts).toEqual(['Đã check-in: xong khối học.'])
  })

  it('keeps a refusal next to the button (never a toast alone), and can be tapped again', async () => {
    const { action, settle } = deferred()
    button(action)
    fireEvent.click(screen.getByRole('button'))
    await act(async () => settle({ ok: false, message: 'Kế hoạch đã thay đổi — tải lại trang.' }))
    expect(screen.getByRole('status').textContent).toBe('Kế hoạch đã thay đổi — tải lại trang.')
    expect(toasts).toEqual([])
    fireEvent.click(screen.getByRole('button'))
    expect(action).toHaveBeenCalledTimes(2)
  })

  it('a failed request (the network) says the save failed', async () => {
    const { action, fail } = deferred()
    button(action)
    fireEvent.click(screen.getByRole('button'))
    await act(async () => fail(new TypeError('Failed to fetch')))
    expect(screen.getByRole('status').textContent).toBe('Không lưu được thay đổi. Bạn thử lại nhé.')
    expect(toasts).toEqual([])
  })
})
