import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CheckInResult } from '../actions'
import type { CheckInInput } from '../schema'
import { CheckInSheet, type CheckInSheetBlock } from './check-in-sheet'

const nav = vi.hoisted(() => ({ replace: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: nav.replace }) }))

const toasts = vi.hoisted(() => [] as string[])
vi.mock('@/components/ui/toaster', () => ({
  toast: (message: string) => {
    toasts.push(message)
  },
}))

const REQUEST_ID = 'c0ffee00-1234-4abc-8def-0123456789ab'
const PLAN_ID = '9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f'
const BLOCK_ID = '2026-09-28:dsa:new:1'
const TOO_LONG = 'Ghi chú quá dài — tối đa 280 ký tự.'
const SAVE_FAILED = 'Không lưu được thay đổi. Bạn thử lại nhé.'

const BLOCK: CheckInSheetBlock = {
  id: BLOCK_ID,
  kindLabel: 'Bài mới',
  trackTitle: 'Cấu trúc dữ liệu & Giải thuật',
  estMinutes: 19.5,
  defaultMinutes: 20,
  checkIn: null,
}

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

function sheet(
  change: Partial<CheckInSheetBlock> = {},
  action: (input: CheckInInput) => Promise<CheckInResult> = deferred().action,
  onClose?: () => void,
) {
  return render(
    <CheckInSheet
      action={action}
      requestId={REQUEST_ID}
      planId={PLAN_ID}
      block={{ ...BLOCK, ...change }}
      onClose={onClose}
    />,
  )
}

const dialog = () => screen.getByRole('dialog', { name: 'Check-in: Bài mới' })
const minutes = () => screen.getByRole('spinbutton', { name: 'Số phút đã học' })
const note = () => screen.getByRole('textbox', { name: 'Ghi chú (không bắt buộc)' })
const submit = () => screen.getByRole('button', { name: 'Lưu check-in' })
const checkedStatus = () =>
  within(screen.getByRole('radiogroup', { name: 'Trạng thái' }))
    .getAllByRole('radio')
    .filter((radio) => radio.getAttribute('aria-checked') === 'true')
    .map((radio) => radio.textContent)

const matchMedia = window.matchMedia
beforeEach(() => {
  nav.replace.mockClear()
  toasts.length = 0
})
afterEach(() => {
  window.matchMedia = matchMedia
})

describe('CheckInSheet (DESIGN_SYSTEM §9, §10)', () => {
  it('a new check-in: status Xong, the pre-filled minutes, an empty note; the title has focus', () => {
    sheet()
    const title = within(dialog()).getByRole('heading', { name: 'Check-in: Bài mới' })
    expect(document.activeElement).toBe(title)
    expect(dialog().textContent).toContain('Cấu trúc dữ liệu & Giải thuật · dự kiến 19,5 phút')
    expect(
      within(screen.getByRole('radiogroup', { name: 'Trạng thái' }))
        .getAllByRole('radio')
        .map((radio) => radio.textContent),
    ).toEqual(['Xong', 'Một phần', 'Bỏ qua'])
    expect(checkedStatus()).toEqual(['Xong'])
    expect(minutes()).toHaveProperty('value', '20')
    expect(note()).toHaveProperty('value', '')
    expect(dialog().textContent).toContain('0/280')
    expect(submit()).toHaveProperty('disabled', false)
  })

  it('an edit is pre-filled with the block’s check-in: status, minutes and note', () => {
    sheet({ checkIn: { status: 'partial', minutes: 25, note: 'Còn bài 2' } })
    expect(checkedStatus()).toEqual(['Một phần'])
    expect(minutes()).toHaveProperty('value', '25')
    expect(note()).toHaveProperty('value', 'Còn bài 2')
    expect(dialog().textContent).toContain('9/280')
  })

  it('is a bottom sheet below md and a dialog from md', () => {
    const { unmount } = sheet()
    expect(dialog().getAttribute('data-slot')).toBe('sheet-content')
    expect(dialog().getAttribute('data-side')).toBe('bottom')
    unmount()
    window.matchMedia = ((query: string) => ({
      ...matchMedia(query),
      matches: query === '(min-width: 768px)',
    })) as typeof window.matchMedia
    sheet()
    expect(dialog().getAttribute('data-slot')).toBe('dialog-content')
  })

  it('Esc goes back to /today with router.replace, so the back button still works (§2.4)', async () => {
    const user = userEvent.setup()
    sheet()
    await user.keyboard('{Escape}')
    expect(nav.replace.mock.calls).toEqual([['/today', { scroll: false }]])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('the close button goes back to /today too; the catalog passes its own onClose', async () => {
    const user = userEvent.setup()
    const { unmount } = sheet()
    await user.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(nav.replace.mock.calls).toEqual([['/today', { scroll: false }]])
    unmount()
    nav.replace.mockClear()
    const onClose = vi.fn()
    sheet({}, deferred().action, onClose)
    await user.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it('counts graphemes live: 280 is fine, 281 disables submit with the error beside the field', () => {
    sheet()
    // 280 user-perceived characters typed in NFD (e + two combining marks each): the server
    // counts graphemes of the NFC note (RF-3).
    fireEvent.change(note(), { target: { value: 'ệ'.repeat(280) } })
    expect(dialog().textContent).toContain('280/280')
    expect(dialog().textContent).not.toContain(TOO_LONG)
    expect(note().getAttribute('aria-invalid')).toBeNull()
    expect(submit()).toHaveProperty('disabled', false)

    fireEvent.change(note(), { target: { value: 'a'.repeat(281) } })
    expect(dialog().textContent).toContain('281/280')
    const error = screen.getByText(TOO_LONG)
    expect(note().getAttribute('aria-invalid')).toBe('true')
    expect(note().getAttribute('aria-describedby')?.split(' ')).toContain(error.closest('p')!.id)
    expect(submit()).toHaveProperty('disabled', true)
  })

  it('steps minutes by 5 within 0–600; a value outside says so and disables submit', () => {
    sheet({ defaultMinutes: 598 })
    const more = screen.getByRole('button', { name: 'Thêm 5 phút' })
    const fewer = screen.getByRole('button', { name: 'Bớt 5 phút' })
    fireEvent.click(more)
    expect(minutes()).toHaveProperty('value', '600')
    expect(more).toHaveProperty('disabled', true)
    fireEvent.click(fewer)
    expect(minutes()).toHaveProperty('value', '595')

    fireEvent.change(minutes(), { target: { value: '601' } })
    expect(screen.getByText('Nhập số phút từ 0 đến 600.')).toBeTruthy()
    expect(minutes().getAttribute('aria-invalid')).toBe('true')
    expect(submit()).toHaveProperty('disabled', true)
    fireEvent.change(minutes(), { target: { value: '2' } })
    fireEvent.click(fewer)
    expect(minutes()).toHaveProperty('value', '0')
    expect(fewer).toHaveProperty('disabled', true)
  })

  it('"Bỏ qua" sets the minutes to 0; back to Xong from 0 restores the pre-filled minutes', async () => {
    const user = userEvent.setup()
    sheet()
    await user.click(screen.getByRole('radio', { name: 'Bỏ qua' }))
    expect(checkedStatus()).toEqual(['Bỏ qua'])
    expect(minutes()).toHaveProperty('value', '0')
    await user.click(screen.getByRole('radio', { name: 'Xong' }))
    expect(minutes()).toHaveProperty('value', '20')
    // Choosing the checked option again never clears the status.
    await user.click(screen.getByRole('radio', { name: 'Xong' }))
    expect(checkedStatus()).toEqual(['Xong'])
  })

  it('submits the check-in with the page’s ids; saving, then a toast and back to /today', async () => {
    const user = userEvent.setup()
    const { action, settle } = deferred()
    sheet({}, action)
    await user.click(screen.getByRole('radio', { name: 'Một phần' }))
    fireEvent.change(minutes(), { target: { value: '10' } })
    fireEvent.change(note(), { target: { value: '  Còn bài 2  ' } })
    await user.click(submit())
    expect(action.mock.calls).toEqual([
      [
        {
          requestId: REQUEST_ID,
          planId: PLAN_ID,
          blockId: BLOCK_ID,
          status: 'partial',
          minutes: 10,
          note: '  Còn bài 2  ',
        },
      ],
    ])
    expect(submit().getAttribute('aria-busy')).toBe('true')
    await act(async () => settle({ ok: true, message: 'Đã check-in: xong một phần khối học.' }))
    expect(toasts).toEqual(['Đã check-in: xong một phần khối học.'])
    expect(nav.replace.mock.calls).toEqual([['/today', { scroll: false }]])
  })

  it('leaves a blank note out (an edit that clears the note removes it)', async () => {
    const user = userEvent.setup()
    const { action, settle } = deferred()
    sheet({ checkIn: { status: 'done', minutes: 20, note: 'cũ' } }, action)
    fireEvent.change(note(), { target: { value: '   ' } })
    await user.click(submit())
    expect(action.mock.calls[0]![0]).toEqual({
      requestId: REQUEST_ID,
      planId: PLAN_ID,
      blockId: BLOCK_ID,
      status: 'done',
      minutes: 20,
    })
    await act(async () => settle({ ok: true, message: 'Đã check-in: xong khối học.' }))
  })

  it('a refusal: the error in a polite live region with "Thử lại", which sends again', async () => {
    const user = userEvent.setup()
    const { action, settle } = deferred()
    sheet({}, action)
    const region = within(dialog()).getByRole('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    await user.click(submit())
    await act(async () => settle({ ok: false, message: 'Kế hoạch đã thay đổi — tải lại trang.' }))
    expect(region.textContent).toContain('Kế hoạch đã thay đổi — tải lại trang.')
    expect(toasts).toEqual([])
    expect(nav.replace).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()

    await user.click(within(region).getByRole('button', { name: 'Thử lại' }))
    expect(action).toHaveBeenCalledTimes(2)
    expect(action.mock.calls[1]).toEqual(action.mock.calls[0])
  })

  it('a failed request (the network) says the save failed, with "Thử lại"', async () => {
    const user = userEvent.setup()
    const { action, fail } = deferred()
    sheet({}, action)
    await user.click(submit())
    await act(async () => fail(new TypeError('Failed to fetch')))
    const region = within(dialog()).getByRole('status')
    expect(region.textContent).toContain(SAVE_FAILED)
    expect(within(region).getByRole('button', { name: 'Thử lại' })).toBeTruthy()
  })
})
