import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ADMIN, cardItem, derivedCardItem, outcomeBinding, pagePropsFor, SAVED } from '../fixtures'
import type { RecordOutcome } from '../outcome'
import { FlashcardPage } from './Page'

describe('FlashcardPage', () => {
  it('shows the front as the h1, in the card’s language, and the tier', () => {
    render(<FlashcardPage {...pagePropsFor(cardItem())} />)
    const front = screen.getByRole('heading', { level: 1, name: 'blocker' })
    expect(front.getAttribute('lang')).toBe('en')
    expect(screen.getByText('Cốt lõi')).toBeTruthy()
  })

  it('"Xem nghĩa" reveals the back (no grade buttons without a binding)', async () => {
    const user = userEvent.setup()
    render(<FlashcardPage {...pagePropsFor(cardItem())} />)
    await user.click(screen.getByRole('button', { name: 'Xem nghĩa' }))
    expect(screen.getByText('vấn đề đang chặn, khiến bạn chưa làm tiếp được')).toBeTruthy()
    expect(screen.getByText(/still waiting for access/).getAttribute('lang')).toBe('en')
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('a derived card reads "Giải thích code"', () => {
    render(<FlashcardPage {...pagePropsFor(derivedCardItem())} />)
    expect(screen.getByText('Giải thích code')).toBeTruthy()
  })

  it('a draft card starts with the draft notice', () => {
    const { container } = render(
      <FlashcardPage {...pagePropsFor(cardItem({ status: 'draft' }), { viewer: ADMIN })} />,
    )
    const main = container.firstElementChild as HTMLElement
    expect(main.firstElementChild?.getAttribute('data-slot')).toBe('banner')
  })
})

describe('FlashcardPage — results (task 5.2c)', () => {
  it('with a binding: after "Xem nghĩa", Biết / Chưa chắc / Không biết grade the card', async () => {
    const user = userEvent.setup()
    const record = vi.fn<RecordOutcome>(async () => SAVED)
    const item = cardItem()
    render(
      <FlashcardPage
        {...pagePropsFor(item, { outcome: outcomeBinding(record, { itemId: item.id }) })}
      />,
    )
    expect(screen.queryByRole('button', { name: /^Biết/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Xem nghĩa' }))
    await user.click(screen.getByRole('button', { name: /^Không biết/ }))
    expect(record.mock.calls[0]![0]).toMatchObject({
      itemId: item.id,
      outcome: { type: 'item.result', result: 'dont_know' },
    })
    expect(screen.getByText('Chưa học')).toBeTruthy()
  })
})
