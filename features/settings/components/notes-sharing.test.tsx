import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Toaster } from '@/components/ui/toaster'
import type { SettingsAction, SettingsResult } from '../schema'
import { NotesSharing } from './notes-sharing'

const REQUEST_ID = '0f8d6a52-3b1c-4d7e-9a2f-6c5b4e3d2a10'

let run = 0

function setup(
  props: Partial<React.ComponentProps<typeof NotesSharing>> = {},
  result?: SettingsResult,
) {
  run += 1
  const message = `Đã lưu chia sẻ ghi chú (${run}).`
  const updateNotesSharing = vi.fn<SettingsAction>(async () => result ?? { ok: true, message })
  const rendered = render(
    <>
      <NotesSharing
        aiPersonalization
        shareNotesWithAi={false}
        requestId={REQUEST_ID}
        updateNotesSharing={updateNotesSharing}
        {...props}
      />
      <Toaster />
    </>,
  )
  return { updateNotesSharing, message, user: userEvent.setup(), ...rendered }
}

describe('NotesSharing', () => {
  it('renders nothing while ai_personalization is off (§4.5)', () => {
    const updateNotesSharing = vi.fn<SettingsAction>(async () => ({ ok: true, message: '' }))
    const { container } = render(
      <NotesSharing
        aiPersonalization={false}
        shareNotesWithAi={false}
        requestId={REQUEST_ID}
        updateNotesSharing={updateNotesSharing}
      />,
    )
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByRole('heading')).toBeNull()
    expect(container.innerHTML).toBe('')
  })

  it('shows the switch, named and described by §4.6, reflecting the saved value', () => {
    setup({ shareNotesWithAi: true })
    expect(screen.getByRole('heading', { name: 'Chia sẻ ghi chú với bot AI' })).toBeTruthy()
    expect(
      screen.getByText('Bot AI và người vận hành bot có thể xem ghi chú bạn chia sẻ.'),
    ).toBeTruthy()
    const toggle = screen.getByRole('switch', { name: 'Chia sẻ ghi chú với bot AI' })
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    // The §4.6 sentence describes the switch itself.
    const describedBy = toggle.getAttribute('aria-describedby')!
    expect(document.getElementById(describedBy)?.textContent).toBe(
      'Bot AI và người vận hành bot có thể xem ghi chú bạn chia sẻ.',
    )
  })

  it('reflects shareNotesWithAi false as unchecked', () => {
    setup({ shareNotesWithAi: false })
    expect(
      screen
        .getByRole('switch', { name: 'Chia sẻ ghi chú với bot AI' })
        .getAttribute('aria-checked'),
    ).toBe('false')
  })

  it('flipping the switch sends the requestId and the new value at once, then toasts', async () => {
    const { updateNotesSharing, message, user } = setup({ shareNotesWithAi: false })
    await user.click(screen.getByRole('switch'))
    await waitFor(() => expect(updateNotesSharing).toHaveBeenCalledTimes(1))
    expect(Object.fromEntries(updateNotesSharing.mock.calls[0]![1].entries())).toEqual({
      requestId: REQUEST_ID,
      shareNotesWithAi: 'true',
    })
    expect(await screen.findByText(message)).toBeTruthy()
  })

  it('turning it back off sends "false"', async () => {
    const { updateNotesSharing, user } = setup({ shareNotesWithAi: true })
    await user.click(screen.getByRole('switch'))
    await waitFor(() => expect(updateNotesSharing).toHaveBeenCalledTimes(1))
    expect(Object.fromEntries(updateNotesSharing.mock.calls[0]![1].entries())).toMatchObject({
      shareNotesWithAi: 'false',
    })
  })

  it('shows a failure in an always-mounted alert region, and goes back to the saved position', async () => {
    const { user } = setup(
      { shareNotesWithAi: false },
      { ok: false, message: 'Tính năng này chỉ dùng được khi tài khoản bật cá nhân hoá AI.' },
    )
    const toggle = screen.getByRole('switch')
    await user.click(toggle)
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Tính năng này chỉ dùng được khi tài khoản bật cá nhân hoá AI.',
      ),
    )
    // Never shows a consent that was not saved (review item 1).
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(toggle.getAttribute('aria-describedby')).toContain(
      document.querySelector('[data-slot="form-field-error"]')!.id,
    )
  })

  it('a failed "off" goes back to on: the notes are still shared', async () => {
    const { user } = setup(
      { shareNotesWithAi: true },
      { ok: false, message: 'Không lưu được thay đổi. Bạn thử lại nhé.' },
    )
    const toggle = screen.getByRole('switch')
    await user.click(toggle)
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Không lưu được thay đổi.'),
    )
    expect(toggle.getAttribute('aria-checked')).toBe('true')
  })

  it('disables the switch while the save is pending', async () => {
    let resolve!: (result: SettingsResult) => void
    const updateNotesSharing = vi.fn<SettingsAction>(() => new Promise((res) => (resolve = res)))
    render(
      <NotesSharing
        aiPersonalization
        shareNotesWithAi={false}
        requestId={REQUEST_ID}
        updateNotesSharing={updateNotesSharing}
      />,
    )
    const user = userEvent.setup()
    const toggle = screen.getByRole('switch')
    await user.click(toggle)
    expect(toggle).toHaveProperty('disabled', true)
    resolve({ ok: true, message: 'Đã lưu.' })
    await waitFor(() => expect(toggle).toHaveProperty('disabled', false))
  })
})
