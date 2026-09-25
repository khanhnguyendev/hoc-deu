import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RubricList } from './rubric-list'

describe('RubricList', () => {
  it('lists the criteria under "Tiêu chí"', () => {
    render(<RubricList items={['polite opener', 'specific issue', 'clear ask']} lang="en" />)
    const list = screen.getByRole('list', { name: 'Tiêu chí' })
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['polite opener', 'specific issue', 'clear ask'])
    expect(list.getAttribute('lang')).toBe('en')
  })

  it('keeps Vietnamese criteria in the page language', () => {
    render(<RubricList items={['Phân tích độ phức tạp']} />)
    expect(screen.getByRole('list', { name: 'Tiêu chí' }).hasAttribute('lang')).toBe(false)
  })

  it('renders nothing for an empty rubric', () => {
    const { container } = render(<RubricList items={[]} />)
    expect(container.innerHTML).toBe('')
  })
})
