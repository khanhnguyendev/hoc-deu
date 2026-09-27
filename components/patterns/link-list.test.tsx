import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LinkList } from './link-list'
import { LinkRow } from './link-row'

describe('LinkList (m-2)', () => {
  it('is a named list of link rows on one bordered surface; rows spaced by default', () => {
    render(
      <LinkList aria-label="Bài liên quan">
        <li>
          <LinkRow href="/t/dsa/items/lc-0001" title="Two Sum" />
        </li>
        <li>
          <LinkRow href="/t/dsa/items/lc-0217" title="Contains Duplicate" />
        </li>
      </LinkList>,
    )
    const list = screen.getByRole('list', { name: 'Bài liên quan' })
    expect(list.getAttribute('data-slot')).toBe('link-list')
    expect(list.className).toContain('border-border')
    expect(list.className).toContain('gap-1')
    expect(list.className).not.toContain('divide-y')
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Two Sum',
      'Contains Duplicate',
    ])
  })

  it('divides its rows with a rule in the divided variant, and keeps a caller’s data-slot', () => {
    render(
      <LinkList variant="divided" aria-labelledby="h" data-slot="related-items">
        <li>a</li>
      </LinkList>,
    )
    const list = screen.getByRole('list')
    expect(list.className).toContain('divide-y')
    expect(list.getAttribute('data-slot')).toBe('related-items')
    expect(list.getAttribute('aria-labelledby')).toBe('h')
  })
})
