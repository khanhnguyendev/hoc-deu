import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { outcomeBinding, REQUEST_ID, SAVED } from '../../fixtures'
import type { RecordOutcome } from '../../outcome'
import { PromptOutcome } from './prompt-outcome'

function setup() {
  const user = userEvent.setup()
  const record = vi.fn<RecordOutcome>(async () => SAVED)
  render(
    <PromptOutcome
      binding={outcomeBinding(record, { itemId: 'dsa:prompt-mock-interview', blockId: 'b-p' })}
    />,
  )
  return { user, record }
}

describe('PromptOutcome', () => {
  it('offers an optional 1–3 self-rating and the one primary "Đã làm xong"', () => {
    setup()
    const rating = screen.getByRole('radiogroup', { name: 'Tự đánh giá (không bắt buộc)' })
    expect(
      within(rating)
        .getAllByRole('radio')
        .map((radio) => radio.textContent),
    ).toEqual(['1 — Chưa tốt', '2 — Tạm được', '3 — Tốt'])
    for (const radio of within(rating).getAllByRole('radio')) {
      expect(radio.getAttribute('aria-checked')).toBe('false')
    }
    expect(screen.getByRole('button', { name: 'Đã làm xong' }).dataset.variant).toBe('primary')
  })

  it('sends prompt.completed without a rating when none is chosen', async () => {
    const { user, record } = setup()
    await user.click(screen.getByRole('button', { name: 'Đã làm xong' }))
    expect(record).toHaveBeenCalledExactlyOnceWith({
      requestId: REQUEST_ID,
      itemId: 'dsa:prompt-mock-interview',
      blockId: 'b-p',
      outcome: { type: 'prompt.completed' },
    })
    expect(await screen.findByText('Đã lưu kết quả.')).toBeTruthy()
  })

  it('sends the chosen rating (3); choosing it again clears it', async () => {
    const { user, record } = setup()
    const three = screen.getByRole('radio', { name: '3 — Tốt' })
    await user.click(three)
    expect(three.getAttribute('aria-checked')).toBe('true')
    await user.click(screen.getByRole('button', { name: 'Đã làm xong' }))
    expect(record.mock.calls[0]![0].outcome).toEqual({ type: 'prompt.completed', selfRating: 3 })
    await screen.findByText('Đã lưu kết quả.')

    await user.click(three)
    expect(three.getAttribute('aria-checked')).toBe('false')
    await user.click(screen.getByRole('button', { name: 'Đã làm xong' }))
    expect(record.mock.calls[1]![0].outcome).toEqual({ type: 'prompt.completed' })
  })

  it('a failure says so next to the button', async () => {
    const user = userEvent.setup()
    const record = vi.fn<RecordOutcome>().mockRejectedValue(new Error('offline'))
    render(<PromptOutcome binding={outcomeBinding(record)} />)
    await user.click(screen.getByRole('button', { name: 'Đã làm xong' }))
    expect((await screen.findByRole('status')).textContent).toBe(
      'Chưa lưu được kết quả. Bạn thử lại nhé.',
    )
  })
})
