import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AdminWarning } from '../overview'
import { AdminWarnings } from './admin-warnings'

const COVERAGE: AdminWarning = {
  key: 'coverage:dsa:10w',
  kind: 'coverage',
  tone: 'danger',
  message: 'DSA (10 tuần): tuần 4, 5 thiếu bài học hoặc ghi chú.',
  action: { label: 'Xem độ phủ nội dung', href: '/admin/content' },
}
const BACKUP: AdminWarning = {
  key: 'backup',
  kind: 'backup',
  tone: 'warning',
  message: 'Không có bản sao lưu thành công nào được xác nhận trong 36 giờ qua.',
  action: {
    label: 'Xem các lần sao lưu',
    href: 'https://github.com/khanhnguyendev/hoc-deu/actions/workflows/backup.yml',
  },
}

describe('AdminWarnings', () => {
  it('is a region titled "Cảnh báo"', () => {
    render(<AdminWarnings warnings={[]} />)
    expect(screen.getByRole('region', { name: 'Cảnh báo' })).toBeTruthy()
  })

  it('says there is no warning when there is none', () => {
    render(<AdminWarnings warnings={[]} />)
    expect(screen.getByText('Không có cảnh báo nào.')).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('shows each warning as a Banner of its tone, in the given order', () => {
    const { container } = render(<AdminWarnings warnings={[COVERAGE, BACKUP]} />)
    const banners = [...container.querySelectorAll('[data-slot="banner"]')]
    expect(banners.map((banner) => banner.getAttribute('data-tone'))).toEqual(['danger', 'warning'])
    expect(banners[0]?.textContent).toContain(COVERAGE.message)
    expect(banners[1]?.textContent).toContain(BACKUP.message)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('gives each warning one action: an admin page in place, a GitHub page in a new tab', () => {
    render(<AdminWarnings warnings={[COVERAGE, BACKUP]} />)
    const content = screen.getByRole('link', { name: 'Xem độ phủ nội dung' })
    expect(content.getAttribute('href')).toBe('/admin/content')
    expect(content.getAttribute('target')).toBeNull()

    const runs = screen.getByRole('link', { name: 'Xem các lần sao lưu (mở trong tab mới)' })
    expect(runs.getAttribute('href')).toBe(BACKUP.action.href)
    expect(runs.getAttribute('target')).toBe('_blank')
    expect(runs.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('never relies on colour alone: every Banner has its icon and its sentence', () => {
    render(<AdminWarnings warnings={[COVERAGE, BACKUP]} />)
    for (const item of screen.getAllByRole('listitem')) {
      const banner = item.querySelector('[data-slot="banner"]')
      expect(banner?.querySelector('svg[aria-hidden="true"]')).toBeTruthy()
      expect(within(item).getByRole('link')).toBeTruthy()
    }
  })
})
