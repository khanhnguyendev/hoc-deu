import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReviewList } from './review-list'

describe('ReviewList (task 5.3)', () => {
  it('renders each slot’s row, and a "Yếu" pill under a Weak one', () => {
    render(
      <ReviewList
        items={[
          { itemId: 'dsa:p1', row: <a href="/x">Two Sum</a>, weak: true },
          { itemId: 'dsa:p2', row: <a href="/y">3Sum</a>, weak: false },
        ]}
      />,
    )
    expect(screen.getByRole('list')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    const [first, second] = screen.getAllByRole('listitem')
    expect(first!.textContent).toContain('Two Sum')
    expect(first!.textContent).toContain('Yếu')
    expect(second!.textContent).not.toContain('Yếu')
  })

  it('renders nothing for an empty list', () => {
    const { container } = render(<ReviewList items={[]} />)
    expect(container.textContent).toBe('')
    expect(container.querySelector('[data-slot="review-list"]')).toBeNull()
  })
})
