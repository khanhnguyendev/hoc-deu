import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi as mock } from 'vitest'
import { Toaster } from '@/components/ui/toaster'
import type { AdminActionResult, BotSettingsInput } from '../actions'
import type { BotControlsView } from '../bot'
import { BotControls } from './bot-controls'

const CONTROLS: BotControlsView = {
  enabled: false,
  dryRun: true,
  contentProposals: false,
  perRunUserCap: 10,
  capMax: 100,
}

let run = 0
function setup(controls: BotControlsView = CONTROLS, result?: AdminActionResult) {
  run += 1
  const message = `Đã lưu (${run}).`
  const updateBotSettings = mock.fn<(input: BotSettingsInput) => Promise<AdminActionResult>>(
    async () => result ?? { ok: true, message },
  )
  render(
    <>
      <BotControls controls={controls} updateBotSettings={updateBotSettings} />
      <Toaster />
    </>,
  )
  return { updateBotSettings, message, user: userEvent.setup() }
}

const control = (name: string) => screen.getByRole('switch', { name })
const cap = () => screen.getByRole('spinbutton', { name: 'Số người dùng tối đa mỗi lần chạy' })

describe('BotControls (§6.2)', () => {
  it('shows the three switches with their saved state and the cap with its hard maximum', () => {
    setup()
    expect(control('Bật bot').getAttribute('aria-checked')).toBe('false')
    expect(control('Chạy thử (dry-run)').getAttribute('aria-checked')).toBe('true')
    expect(control('Đề xuất nội dung').getAttribute('aria-checked')).toBe('false')
    expect((cap() as HTMLInputElement).value).toBe('10')
    expect(cap().getAttribute('min')).toBe('1')
    expect(cap().getAttribute('max')).toBe('100')
    expect(screen.getByText('Từ 1 đến 100 (giới hạn cứng).')).toBeTruthy()
  })

  it.each([
    ['Bật bot', { enabled: true }],
    ['Chạy thử (dry-run)', { dryRun: false }],
    ['Đề xuất nội dung', { contentProposals: true }],
  ] as const)('"%s" saves only its own field, and toasts', async (name, input) => {
    const { updateBotSettings, message, user } = setup()
    await user.click(control(name))
    await waitFor(() => expect(updateBotSettings).toHaveBeenCalledWith(input))
    expect(updateBotSettings).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(message)).toBeTruthy()
    expect(control(name).getAttribute('aria-checked')).toBe(String(Object.values(input)[0]))
  })

  it('saves the cap with its own form', async () => {
    const { updateBotSettings, user } = setup()
    await user.clear(cap())
    await user.type(cap(), '25')
    const form = cap().closest('form')!
    await user.click(within(form).getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(updateBotSettings).toHaveBeenCalledWith({ perRunUserCap: 25 }))
  })

  it.each(['0', '101', '2.5', ''])(
    'refuses the cap %j in the form, without a request',
    async (value) => {
      const { updateBotSettings, user } = setup()
      await user.clear(cap())
      if (value) await user.type(cap(), value)
      await user.click(screen.getByRole('button', { name: 'Lưu' }))
      expect(await screen.findByText('Nhập một số nguyên từ 1 đến 100.')).toBeTruthy()
      expect(cap().getAttribute('aria-invalid')).toBe('true')
      expect(updateBotSettings).not.toHaveBeenCalled()
    },
  )

  it('follows a re-render with a new saved cap (this save, or another admin’s)', () => {
    const updateBotSettings = mock.fn<(input: BotSettingsInput) => Promise<AdminActionResult>>()
    const { rerender } = render(
      <BotControls controls={CONTROLS} updateBotSettings={updateBotSettings} />,
    )
    expect((cap() as HTMLInputElement).value).toBe('10')
    rerender(
      <BotControls
        controls={{ ...CONTROLS, perRunUserCap: 42 }}
        updateBotSettings={updateBotSettings}
      />,
    )
    expect((cap() as HTMLInputElement).value).toBe('42')
  })

  it('keeps an edit typed before the re-render arrives, with its error', async () => {
    const updateBotSettings = mock.fn<(input: BotSettingsInput) => Promise<AdminActionResult>>()
    const user = userEvent.setup()
    const { rerender } = render(
      <BotControls controls={CONTROLS} updateBotSettings={updateBotSettings} />,
    )
    await user.clear(cap())
    await user.type(cap(), '101')
    await user.click(screen.getByRole('button', { name: 'Lưu' }))
    expect(screen.getByText('Nhập một số nguyên từ 1 đến 100.')).toBeTruthy()
    rerender(
      <BotControls
        controls={{ ...CONTROLS, perRunUserCap: 11 }}
        updateBotSettings={updateBotSettings}
      />,
    )
    expect((cap() as HTMLInputElement).value).toBe('101')
    expect(screen.getByText('Nhập một số nguyên từ 1 đến 100.')).toBeTruthy()
    expect(updateBotSettings).not.toHaveBeenCalled()
  })

  it('on a failed save goes back to the saved state and says why beside the control', async () => {
    const { user } = setup(CONTROLS, { ok: false, message: 'Không lưu được (y).' })
    await user.click(control('Bật bot'))
    expect((await screen.findAllByText('Không lưu được (y).')).length).toBeGreaterThanOrEqual(1)
    await waitFor(() => expect(control('Bật bot').getAttribute('aria-checked')).toBe('false'))
  })
})
