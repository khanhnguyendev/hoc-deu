import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatCard } from './stat-card'

describe('StatCard — M1 #15 (DESIGN_SYSTEM §4.3)', () => {
  it('tightens the tracking of a number only', () => {
    render(<StatCard label="Thẻ đã thuộc" value={1234} hint="Tuần này" />)
    const value = screen.getByText('1.234')
    expect(value.className).toContain('tracking-tight')
    expect(screen.getByText('Thẻ đã thuộc').className).not.toContain('tracking-tight')
    expect(screen.getByText('Tuần này').className).not.toContain('tracking-tight')
  })

  it('never tightens a text value: Vietnamese diacritics must not collide', () => {
    render(<StatCard label="Dự kiến xong" value="12,4 tuần" />)
    const value = screen.getByText('12,4 tuần')
    expect(value.className).not.toContain('tracking-tight')
    expect(value.className).toContain('tabular-nums')
  })

  it('with href is one link: the card inside with Card’s interactive hover (m-2)', () => {
    render(<StatCard label="Cần ôn hôm nay" value={12} hint="Mở Ôn tập" href="/review" />)
    const link = screen.getByRole('link', { name: /Cần ôn hôm nay/ })
    expect(link.getAttribute('href')).toBe('/review')
    const card = link.querySelector('[data-slot="stat-card"]')!
    expect(card.className).toContain('hover:shadow-sm')
    expect(link.textContent).toContain('12')
  })

  it('without href is no link and no hover', () => {
    render(<StatCard label="Phút" value={45} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Phút').closest('[data-slot="stat-card"]')?.className).not.toContain(
      'hover:shadow-sm',
    )
  })
})
