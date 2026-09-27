import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReviewList } from './review-list'

describe('ReviewList (task 5.3)', () => {
  it('renders each slot’s row in a plain list', () => {
    render(
      <ReviewList
        items={[
          { itemId: 'dsa:p1', row: <a href="/x">Two Sum</a> },
          { itemId: 'dsa:p2', row: <a href="/y">3Sum</a> },
        ]}
      />,
    )
    expect(screen.getByRole('list')).toBeTruthy()
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]!.textContent).toBe('Two Sum')
    expect(items[1]!.textContent).toBe('3Sum')
  })

  it('renders nothing for an empty list', () => {
    const { container } = render(<ReviewList items={[]} />)
    expect(container.textContent).toBe('')
    expect(container.querySelector('[data-slot="review-list"]')).toBeNull()
  })
})
