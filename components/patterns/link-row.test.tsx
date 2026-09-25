import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LinkRow } from './link-row'

describe('LinkRow', () => {
  it('is one link for the whole row: title, meta, badges and trailing inside it', () => {
    render(
      <LinkRow
        href="/t/dsa/items/lc-0001"
        title="Two Sum"
        titleLang="en"
        meta={['#1', 'Easy', 'Arrays & Hashing']}
        badges={<span>Premium</span>}
        trailing={<span>Chưa học</span>}
      />,
    )
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/t/dsa/items/lc-0001')
    expect(link.getAttribute('data-slot')).toBe('link-row')
    for (const text of ['Two Sum', '#1', 'Easy', 'Arrays & Hashing', 'Premium', 'Chưa học']) {
      expect(within(link).getByText(text)).toBeTruthy()
    }
  })

  it('marks the title language and joins the meta with hidden separators', () => {
    render(<LinkRow href="/x" title="Two Sum" titleLang="en" meta={['#1', 'Easy']} />)
    const link = screen.getByRole('link')
    expect(within(link).getByText('Two Sum').getAttribute('lang')).toBe('en')
    const meta = link.querySelector('[data-slot="link-row-meta"]')
    expect(meta?.textContent).toBe('#1 · Easy')
    const separators = meta?.querySelectorAll('[aria-hidden="true"]') ?? []
    expect(separators).toHaveLength(1)
  })

  it('is at least 44 px tall (min-h-11) and renders no meta, badges or trailing when absent', () => {
    render(<LinkRow href="/x" title="Điền từ còn thiếu" />)
    const link = screen.getByRole('link', { name: 'Điền từ còn thiếu' })
    expect(link.className).toContain('min-h-11')
    expect(link.querySelector('[data-slot="link-row-meta"]')).toBeNull()
    expect(within(link).getByText('Điền từ còn thiếu').hasAttribute('lang')).toBe(false)
  })
})
