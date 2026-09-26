import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { cardItem, derivedCardItem, REQUEST_ID, SAVED } from '../../fixtures'
import type { CardSessionProps, RecordOutcome } from '../../outcome'
import { CardSession } from './card-session'

const sidesOf = (item: ReturnType<typeof cardItem>) => {
  const { front, back, hint, usage, example, pronunciation, lang } = item.content
  return { front, back, hint, usage, example, pronunciation, lang }
}

const BLOCKER = cardItem()
const UNBLOCK = cardItem({
  id: 'english:w01-unblock',
  localId: 'w01-unblock',
  title: 'unblock',
  content: { id: 'english:w01-unblock', front: 'unblock', back: 'gỡ vướng cho ai đó' },
})
const DERIVED = derivedCardItem()

const CARDS: CardSessionProps['cards'] = [
  { itemId: BLOCKER.id, sides: sidesOf(BLOCKER), blockId: 'b-review' },
  { itemId: UNBLOCK.id, sides: sidesOf(UNBLOCK), blockId: 'b-review' },
  { itemId: DERIVED.id, sides: sidesOf(DERIVED) },
]

const front = (name: string) => screen.getByRole('heading', { level: 2, name })

async function reveal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Xem nghĩa' }))
}

describe('CardSession (decision 19)', () => {
  it('starts on the first card with the remaining count; grades appear after "Xem nghĩa"', async () => {
    const user = userEvent.setup()
    render(<CardSession cards={CARDS} requestId={REQUEST_ID} record={vi.fn()} />)
    expect(front('blocker')).toBeTruthy()
    expect(screen.getByText('Còn 3 thẻ')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Biết/ })).toBeNull()
    await reveal(user)
    expect(screen.getByRole('button', { name: /^Biết/ })).toBeTruthy()
  })

  it('a grade sends { requestId, itemId, blockId, outcome } and moves to the next card', async () => {
    const user = userEvent.setup()
    const record = vi.fn<RecordOutcome>(async () => SAVED)
    render(<CardSession cards={CARDS} requestId={REQUEST_ID} record={record} />)
    await reveal(user)
    await user.click(screen.getByRole('button', { name: /^Chưa chắc/ }))
    expect(record).toHaveBeenCalledExactlyOnceWith({
      requestId: REQUEST_ID,
      itemId: BLOCKER.id,
      blockId: 'b-review',
      outcome: { type: 'item.result', result: 'unsure' },
    })
    expect(await screen.findByRole('heading', { level: 2, name: 'unblock' })).toBeTruthy()
    expect(screen.getByText('Còn 2 thẻ')).toBeTruthy()
    // The next card starts on its front, and focus is on its "Xem nghĩa".
    expect(screen.queryByText('gỡ vướng cho ai đó')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Xem nghĩa' }))
    expect(screen.getByRole('status').textContent).toContain('Chưa chắc')
  })

  it('grades three cards in order even when its cards prop shrinks after the first (a revalidation)', async () => {
    const user = userEvent.setup()
    const record = vi.fn<RecordOutcome>(async () => SAVED)
    const { rerender } = render(
      <CardSession cards={CARDS} requestId={REQUEST_ID} record={record} />,
    )
    await reveal(user)
    await user.click(screen.getByRole('button', { name: /^Biết/ }))
    await screen.findByRole('heading', { level: 2, name: 'unblock' })
    // The page re-renders without the graded card and with a new render's request id.
    rerender(
      <CardSession
        cards={CARDS.slice(1)}
        requestId="11111111-2222-4333-8444-555555555555"
        record={record}
      />,
    )
    expect(front('unblock')).toBeTruthy()
    await reveal(user)
    await user.click(screen.getByRole('button', { name: /^Không biết/ }))
    await screen.findByRole('heading', {
      level: 2,
      name: 'Explain the optimal approach for Two Sum in English.',
    })
    await reveal(user)
    act(() => {
      fireEvent.keyDown(document.body, { key: '1' })
    })
    expect(await screen.findByRole('heading', { name: 'Đã ôn xong' })).toBeTruthy()
    expect(
      record.mock.calls.map(([input]) => [input.itemId, input.outcome, input.requestId]),
    ).toEqual([
      [BLOCKER.id, { type: 'item.result', result: 'know' }, REQUEST_ID],
      [UNBLOCK.id, { type: 'item.result', result: 'dont_know' }, REQUEST_ID],
      [DERIVED.id, { type: 'item.result', result: 'know' }, REQUEST_ID],
    ])
    // The last card has no block: none is sent.
    expect(record.mock.calls[2]![0]).not.toHaveProperty('blockId')
    expect(screen.getByText('Bạn đã chấm 3 thẻ.')).toBeTruthy()
  })

  it('shows the error state with "Thử lại" when record fails; a retry resends the same input', async () => {
    const user = userEvent.setup()
    const record = vi
      .fn<RecordOutcome>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        ok: false,
        message: 'Kế hoạch đã thay đổi — tải lại trang.',
        autoCheckedIn: [],
      })
      .mockResolvedValueOnce(SAVED)
    render(<CardSession cards={CARDS} requestId={REQUEST_ID} record={record} />)
    await reveal(user)
    await user.click(screen.getByRole('button', { name: /^Biết/ }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Chưa lưu được kết quả')
    expect(front('blocker')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Kế hoạch đã thay đổi — tải lại trang.',
    )
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'unblock' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(record.mock.calls.map(([input]) => input)).toEqual([
      record.mock.calls[0]![0],
      record.mock.calls[0]![0],
      record.mock.calls[0]![0],
    ])
  })

  it('shows the empty state for a session without cards', () => {
    render(<CardSession cards={[]} requestId={REQUEST_ID} record={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Không có thẻ nào để ôn' })).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('ends with "Đã ôn xong" after the last card', async () => {
    const user = userEvent.setup()
    const record = vi.fn<RecordOutcome>(async () => SAVED)
    render(<CardSession cards={CARDS.slice(0, 1)} requestId={REQUEST_ID} record={record} />)
    expect(screen.getByText('Còn 1 thẻ')).toBeTruthy()
    await reveal(user)
    await user.click(screen.getByRole('button', { name: /^Biết/ }))
    const done = await screen.findByRole('heading', { name: 'Đã ôn xong' })
    expect(screen.getByText('Bạn đã chấm 1 thẻ.')).toBeTruthy()
    // Focus follows to the end state (the graded card's buttons are gone).
    expect(document.activeElement?.contains(done)).toBe(true)
  })
})
