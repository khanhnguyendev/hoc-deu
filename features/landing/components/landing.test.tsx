import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Landing } from './landing'

describe('Landing', () => {
  it('has the headline as the one h1, the lead and the approval note', () => {
    render(<Landing />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Mỗi ngày một chút. Đều là đủ.' }),
    ).toBeTruthy()
    expect(screen.getByText(/Lộ trình chỉ đi tiếp vào những ngày bạn học\./)).toBeTruthy()
    expect(screen.getByText(/Tài khoản mới cần quản trị viên duyệt/)).toBeTruthy()
    expect(screen.queryByText(/AI giúp bạn/)).toBeNull()
  })

  it('offers "Bắt đầu học" to /sign-in in the hero and again in the close', () => {
    render(<Landing />)
    const ctas = screen.getAllByRole('link', { name: 'Bắt đầu học' })
    expect(ctas).toHaveLength(2)
    for (const link of ctas) expect(link.getAttribute('href')).toBe('/sign-in')
  })

  it('shows the deleted-account notice when `deleted` (§4.6)', () => {
    const { rerender } = render(<Landing />)
    expect(screen.queryByText('Tài khoản của bạn đã được xoá.')).toBeNull()
    rerender(<Landing deleted />)
    expect(screen.getByText('Tài khoản của bạn đã được xoá.')).toBeTruthy()
  })

  it('has the day, tracks, missed-day and close sections, each named by a heading', () => {
    render(<Landing />)
    for (const name of [
      'Một ngày học',
      'Hai lộ trình chạy song song',
      'Bỏ lỡ một ngày chỉ mất một ngày',
      'Bắt đầu với kế hoạch của hôm nay',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeTruthy()
    }
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(3)
    expect(screen.getByRole('heading', { level: 3, name: 'Check-in' })).toBeTruthy()
  })

  it('shows each track on its own accent', () => {
    const { container } = render(<Landing />)
    const accents = [...container.querySelectorAll('[data-slot="track-sheet"]')].map((el) =>
      el.getAttribute('data-accent'),
    )
    expect(accents).toEqual(['track-1', 'track-2'])
  })

  it('says AI planning is coming, and leaves the footer to the page frame', () => {
    render(<Landing />)
    expect(screen.getByText('AI cá nhân hoá kế hoạch: sắp có')).toBeTruthy()
    expect(screen.queryByRole('contentinfo')).toBeNull()
  })

  it('keeps the missed-day grid decorative, labelled "Ví dụ", with the meaning in text', () => {
    const { container } = render(<Landing />)
    const grid = container.querySelector('[data-slot="missed-day-grid"]')
    expect(grid?.querySelectorAll('[data-slot="heat-cell"]')).toHaveLength(42)
    expect(grid?.querySelectorAll('[data-level="0"]')).toHaveLength(2)
    for (const cell of grid?.querySelectorAll('[data-slot="heat-cell"]') ?? []) {
      expect(cell.closest('[aria-hidden="true"]')).not.toBeNull()
    }
    expect(screen.queryByText('Ví dụ')).toBeNull()
    expect(
      within(grid as HTMLElement).getByText('Ví dụ: sáu tuần học, có hai ngày trống'),
    ).toBeTruthy()
    for (const cell of grid?.querySelectorAll('[data-level="0"]') ?? []) {
      expect(cell.className).toContain('border-dashed')
    }
  })
})
