import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FIXTURE_LINKS } from '../fixtures'
import { RelatedItems } from './related-items'

describe('RelatedItems', () => {
  it('lists each linked item as a row: role label, #leetcode, difficulty; English titles', () => {
    render(
      <RelatedItems
        items={[
          { label: 'Bài mẫu', link: FIXTURE_LINKS['dsa:lc-0167']! },
          { label: 'Bài học chuyên sâu', link: FIXTURE_LINKS['dsa:lesson-two-sum']! },
        ]}
      />,
    )
    const list = screen.getByRole('list', { name: 'Bài liên quan' })
    const [anchor, deepDive] = within(list).getAllByRole('link')
    expect(anchor?.getAttribute('href')).toBe('/t/dsa/items/lc-0167')
    expect(anchor?.querySelector('[data-slot="link-row-meta"]')?.textContent).toBe(
      'Bài mẫu · #167 · Medium',
    )
    expect(
      within(anchor!).getByText('Two Sum II - Input Array Is Sorted').getAttribute('lang'),
    ).toBe('en')
    expect(deepDive?.querySelector('[data-slot="link-row-meta"]')?.textContent).toBe(
      'Bài học chuyên sâu',
    )
    expect(within(deepDive!).getByText('Two Sum, từng bước').hasAttribute('lang')).toBe(false)
  })

  it('renders nothing for no items', () => {
    const { container } = render(<RelatedItems items={[]} />)
    expect(container.innerHTML).toBe('')
  })
})
