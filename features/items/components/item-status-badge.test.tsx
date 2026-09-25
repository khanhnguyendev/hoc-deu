import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ItemStatusBadge, ItemStatusNotice } from './item-status-badge'

describe('ItemStatusBadge (rows)', () => {
  it('draft → "Bản nháp"; retired → "Đã ngừng"; each with an icon', () => {
    const { container, rerender } = render(<ItemStatusBadge status="draft" />)
    expect(screen.getByText('Bản nháp')).toBeTruthy()
    expect(container.querySelector('svg')).not.toBeNull()
    rerender(<ItemStatusBadge status="retired" />)
    expect(screen.getByText('Đã ngừng')).toBeTruthy()
  })

  it('active → nothing', () => {
    const { container } = render(<ItemStatusBadge status="active" />)
    expect(container.innerHTML).toBe('')
  })
})

describe('ItemStatusNotice (pages)', () => {
  it('draft → an info banner saying only admins see it', () => {
    const { container } = render(<ItemStatusNotice status="draft" />)
    const banner = container.querySelector('[data-slot="banner"]')
    expect(banner?.getAttribute('data-tone')).toBe('info')
    expect(screen.getByText(/Bản nháp/).textContent).toMatch(/quản trị viên/)
  })

  it('retired → a warning banner', () => {
    const { container } = render(<ItemStatusNotice status="retired" />)
    expect(container.querySelector('[data-slot="banner"]')?.getAttribute('data-tone')).toBe(
      'warning',
    )
    expect(screen.getByText(/đã ngừng/)).toBeTruthy()
  })

  it('active → nothing', () => {
    const { container } = render(<ItemStatusNotice status="active" />)
    expect(container.innerHTML).toBe('')
  })
})
