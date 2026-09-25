import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RubricList } from './rubric-list'

describe('RubricList', () => {
  it('lists the criteria under an h2 "Tiêu chí"', () => {
    render(<RubricList items={['polite opener', 'specific issue', 'clear ask']} lang="en" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Tiêu chí' })).toBeTruthy()
    const list = screen.getByRole('list', { name: 'Tiêu chí' })
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['polite opener', 'specific issue', 'clear ask'])
  })

  it('marks English criteria lang="en"; Vietnamese ones (the default) keep the page language', () => {
    const { rerender } = render(<RubricList items={['what you did']} lang="en" />)
    expect(screen.getByRole('list', { name: 'Tiêu chí' }).getAttribute('lang')).toBe('en')
    rerender(<RubricList items={['Phân tích độ phức tạp']} lang="vi" />)
    expect(screen.getByRole('list', { name: 'Tiêu chí' }).hasAttribute('lang')).toBe(false)
    rerender(<RubricList items={['Phân tích độ phức tạp']} />)
    expect(screen.getByRole('list', { name: 'Tiêu chí' }).hasAttribute('lang')).toBe(false)
  })

  it('takes a heading level (h3 inside another section)', () => {
    render(<RubricList items={['clear ask']} headingLevel={3} />)
    expect(screen.getByRole('heading', { level: 3, name: 'Tiêu chí' })).toBeTruthy()
  })

  it('renders nothing for an empty rubric', () => {
    const { container } = render(<RubricList items={[]} />)
    expect(container.innerHTML).toBe('')
  })
})
