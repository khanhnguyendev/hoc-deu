import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VariantLinks } from './variant-links'

const VARIANTS = [
  { id: '8w', label: '8 tuần', href: '/t/dsa?variant=8w', current: false },
  { id: '10w', label: '10 tuần', href: '/t/dsa?variant=10w', current: true },
]

describe('VariantLinks', () => {
  it('is a navigation named "Phiên bản lộ trình" with one link per roadmap', () => {
    render(<VariantLinks variants={VARIANTS} />)
    const nav = screen.getByRole('navigation', { name: 'Phiên bản lộ trình' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['8 tuần', '10 tuần'])
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/t/dsa?variant=8w',
      '/t/dsa?variant=10w',
    ])
  })

  it('marks only the current variant with aria-current="true"', () => {
    render(<VariantLinks variants={VARIANTS} />)
    expect(screen.getByRole('link', { name: '10 tuần' }).getAttribute('aria-current')).toBe('true')
    expect(screen.getByRole('link', { name: '8 tuần' }).hasAttribute('aria-current')).toBe(false)
  })

  it('shows a single roadmap as the current one', () => {
    render(
      <VariantLinks
        variants={[{ id: '10w', label: '10 tuần', href: '/t/english?variant=10w', current: true }]}
      />,
    )
    expect(screen.getByRole('link', { name: '10 tuần' }).getAttribute('aria-current')).toBe('true')
  })
})
