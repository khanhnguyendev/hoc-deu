import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { cardItem, derivedCardItem } from '../fixtures'
import { FlashcardView } from './flashcard-view'

describe('FlashcardView', () => {
  it('shows the front as a heading in the card’s front language, the back hidden', () => {
    render(<FlashcardView card={cardItem().content} headingLevel={1} />)
    const front = screen.getByRole('heading', { level: 1, name: 'blocker' })
    expect(front.getAttribute('lang')).toBe('en')
    expect(screen.queryByText(/vấn đề đang chặn/)).toBeNull()
    const toggle = screen.getByRole('button', { name: 'Xem nghĩa' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('"Xem nghĩa" reveals back, hint, usage, example and pronunciation; then hides them', async () => {
    const user = userEvent.setup()
    render(<FlashcardView card={cardItem().content} />)
    await user.click(screen.getByRole('button', { name: 'Xem nghĩa' }))

    const back = screen.getByText('vấn đề đang chặn, khiến bạn chưa làm tiếp được')
    expect(back.closest('[lang]')?.getAttribute('lang')).toBe('vi')
    expect(screen.getByText('Hay đi với "have" hoặc "hit".')).toBeTruthy()
    expect(screen.getByText('danh từ · trung tính')).toBeTruthy()
    expect(screen.getByText('Thường nói "I have one blocker: …".')).toBeTruthy()
    const example = screen.getByText(/still waiting for access/)
    expect(example.getAttribute('lang')).toBe('en')
    expect(screen.getByText('/ˈblɒk.ər/ · BLOCK-er').getAttribute('lang')).toBe('en')
    for (const label of ['Gợi ý', 'Cách dùng', 'Ví dụ', 'Phát âm']) {
      expect(screen.getByText(label)).toBeTruthy()
    }

    const toggle = screen.getByRole('button', { name: 'Ẩn nghĩa' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    await user.click(toggle)
    expect(screen.queryByText(/vấn đề đang chặn/)).toBeNull()
  })

  it('a derived card: back and hint in their own languages, no vocabulary fields', async () => {
    const user = userEvent.setup()
    render(<FlashcardView card={derivedCardItem().content} />)
    expect(
      screen
        .getByRole('heading', { name: 'Explain the optimal approach for Two Sum in English.' })
        .getAttribute('lang'),
    ).toBe('en')
    await user.click(screen.getByRole('button', { name: 'Xem nghĩa' }))
    expect(
      screen
        .getByText(/Store each number/)
        .closest('[lang]')
        ?.getAttribute('lang'),
    ).toBe('en')
    expect(
      screen
        .getByText(/Lưu mỗi số/)
        .closest('[lang]')
        ?.getAttribute('lang'),
    ).toBe('vi')
    expect(screen.queryByText('Cách dùng')).toBeNull()
    expect(screen.queryByText('Ví dụ')).toBeNull()
    expect(screen.queryByText('Phát âm')).toBeNull()
  })

  it('has no grade buttons yet (task 5.2)', () => {
    render(<FlashcardView card={cardItem().content} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})
