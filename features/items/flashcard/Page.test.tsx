import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ADMIN, cardItem, derivedCardItem, pagePropsFor } from '../fixtures'
import { FlashcardPage } from './Page'

describe('FlashcardPage', () => {
  it('shows the front as the h1, in the card’s language, and the tier', () => {
    render(<FlashcardPage {...pagePropsFor(cardItem())} />)
    const front = screen.getByRole('heading', { level: 1, name: 'blocker' })
    expect(front.getAttribute('lang')).toBe('en')
    expect(screen.getByText('Cốt lõi')).toBeTruthy()
  })

  it('"Xem nghĩa" reveals the back (no grade buttons until 5.2)', async () => {
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
