import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { cardItem, derivedCardItem } from '../fixtures'
import { FlashcardRow } from './Row'

describe('FlashcardRow', () => {
  it('is one link: the front in its language and the tier label', () => {
    render(<FlashcardRow item={cardItem()} state={null} href="/t/english/items/w01-blocker" />)
    const row = screen.getByRole('link')
    expect(within(row).getByText('blocker').getAttribute('lang')).toBe('en')
    expect(row.querySelector('[data-slot="link-row-meta"]')?.textContent).toBe('Cốt lõi')
  })

  it.each([
    ['extended', 'Mở rộng'],
    ['core', 'Cốt lõi'],
  ] as const)('tier %s reads "%s"', (tier, label) => {
    render(<FlashcardRow item={cardItem({ content: { tier } })} state={null} href="/x" />)
    expect(within(screen.getByRole('link')).getByText(label)).toBeTruthy()
  })

  it('a derived card reads "Giải thích code"', () => {
    render(<FlashcardRow item={derivedCardItem()} state={null} href="/x" />)
    expect(within(screen.getByRole('link')).getByText('Giải thích code')).toBeTruthy()
  })

  it('shows the status pill with showStatus, and "Đã ngừng" for a retired card', () => {
    render(
      <FlashcardRow
        item={cardItem({ status: 'retired' })}
        state={{ status: 'mastered', level: 4, dueOn: null }}
        href="/x"
        showStatus
      />,
    )
    const row = screen.getByRole('link')
    expect(within(row).getByText('Thành thạo')).toBeTruthy()
    expect(within(row).getByText('Đã ngừng')).toBeTruthy()
  })
})
