import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi as mock } from 'vitest'
import { Toaster } from '@/components/ui/toaster'
import type { rotateBotToken } from '../actions'
import type { BotTokenView } from '../bot'
import { BotToken } from './bot-token'

type Rotate = typeof rotateBotToken
const TOKEN = `hdb_${'Q'.repeat(43)}`

afterEach(async () => {
  cleanup()
  await new Promise((resolve) => setTimeout(resolve, 0))
})

function setup(token: BotTokenView, result?: Awaited<ReturnType<Rotate>>) {
  const rotate = mock.fn<Rotate>(
    async () => result ?? { ok: true, token: TOKEN, message: 'Đã tạo token mới.' },
  )
  const view = render(
    <>
      <BotToken token={token} rotateBotToken={rotate} />
      <Toaster />
    </>,
  )
  return { rotate, view, user: userEvent.setup() }
}

describe('BotToken (§6.3, ADR-0026)', () => {
  it('says "Chưa có token" before the first token', () => {
    setup({ state: 'none' })
    expect(screen.getByText('Chưa có token')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tạo token mới' })).toBeTruthy()
  })

  it('says when the current token was made', () => {
    setup({ state: 'set', createdAt: '09:30, 28 tháng 9, 2026', previousValidUntil: null })
    expect(screen.getByText('Token hiện tại tạo lúc 09:30, 28 tháng 9, 2026')).toBeTruthy()
    expect(screen.queryByText(/Token cũ/)).toBeNull()
  })

  it('shows the overlap while the old token still works', () => {
    setup({
      state: 'set',
      createdAt: '09:30, 28 tháng 9, 2026',
      previousValidUntil: '09:30, 29 tháng 9, 2026',
    })
    expect(screen.getByText('Token cũ còn dùng được đến 09:30, 29 tháng 9, 2026')).toBeTruthy()
  })

  it('says a token exists when its time is unknown', () => {
    setup({ state: 'set', createdAt: null, previousValidUntil: null })
    expect(screen.getByText('Đã có token')).toBeTruthy()
  })

  it('asks first — for the first token without the 24-hour sentence; "Huỷ" makes no token', async () => {
    const { rotate, user } = setup({ state: 'none' })
    await user.click(screen.getByRole('button', { name: 'Tạo token mới' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Tạo token đầu tiên?' })
    expect(within(dialog).queryByText(/24 giờ/)).toBeNull()
    await user.click(within(dialog).getByRole('button', { name: 'Huỷ' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(rotate).not.toHaveBeenCalled()
  })

  it('a rotation says the old token keeps working 24 hours', async () => {
    const { rotate, user } = setup({
      state: 'set',
      createdAt: '09:30, 28 tháng 9, 2026',
      previousValidUntil: null,
    })
    await user.click(screen.getByRole('button', { name: 'Tạo token mới' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Tạo token mới?' })
    expect(within(dialog).getByText(/24 giờ/)).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Huỷ' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(rotate).not.toHaveBeenCalled()
  })

  it('shows the new token once, read-only, with a copy button and "Token chỉ hiện một lần"', async () => {
    const { rotate, user } = setup({ state: 'none' })
    await user.click(screen.getByRole('button', { name: 'Tạo token mới' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Tạo token mới' }))
    await waitFor(() => expect(rotate).toHaveBeenCalledTimes(1))

    const field = await screen.findByRole('textbox', { name: 'Token mới' })
    expect((field as HTMLInputElement).value).toBe(TOKEN)
    expect((field as HTMLInputElement).readOnly).toBe(true)
    expect(screen.getByText('Token chỉ hiện một lần')).toBeTruthy()
    expect(await screen.findByText('Đã tạo token mới.')).toBeTruthy()

    const writeText = mock.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await user.click(screen.getByRole('button', { name: 'Sao chép' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(TOKEN))
    expect(await screen.findByText('Đã sao chép token.')).toBeTruthy()
  })

  it('moves focus to the new token once the dialog closes (review item 10)', async () => {
    const { user } = setup({ state: 'none' })
    await user.click(screen.getByRole('button', { name: 'Tạo token mới' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Tạo token mới' }))
    const field = await screen.findByRole('textbox', { name: 'Token mới' })
    await waitFor(() => expect(document.activeElement).toBe(field))
  })

  it('after a failure focus goes back to "Tạo token mới"', async () => {
    const { user } = setup({ state: 'none' }, { ok: false, message: 'Không tạo được (y).' })
    const opener = screen.getByRole('button', { name: 'Tạo token mới' })
    await user.click(opener)
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Tạo token mới' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(opener))
  })

  it('never puts a token in the markup of a fresh render (a reload shows only the time)', () => {
    const { view } = setup({
      state: 'set',
      createdAt: '09:30, 28 tháng 9, 2026',
      previousValidUntil: null,
    })
    expect(view.container.innerHTML).not.toContain('hdb_')
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('on failure shows no token and says why', async () => {
    const { user } = setup({ state: 'none' }, { ok: false, message: 'Không tạo được (z).' })
    await user.click(screen.getByRole('button', { name: 'Tạo token mới' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Tạo token mới' }))
    expect((await screen.findAllByText('Không tạo được (z).')).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
