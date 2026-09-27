import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TrackStats } from '../content'
import { CatalogStats } from './catalog-stats'

const DSA: TrackStats = {
  trackTitle: 'Cấu trúc dữ liệu & Giải thuật',
  rows: [
    { type: 'lesson', label: 'Lesson', active: 5, draft: 1, retired: 0 },
    { type: 'problem', label: 'Problem', active: 114, draft: 2, retired: 1 },
  ],
  total: 123,
  verification: { tested: 24, compileOnly: 3, noNote: 87 },
}

describe('CatalogStats', () => {
  it('shows the items by type and status in a labelled, focusable scroll region', () => {
    render(<CatalogStats stats={DSA} />)
    expect(screen.getByRole('heading', { level: 3, name: 'Số mục' })).toBeTruthy()
    const region = screen.getByRole('region', {
      name: 'Số mục của Cấu trúc dữ liệu & Giải thuật theo loại và trạng thái',
    })
    expect(region.getAttribute('tabindex')).toBe('0')
    const table = within(region).getByRole('table')
    const rows = within(table).getAllByRole('row')
    expect(rows.map((row) => row.textContent)).toEqual([
      'LoạiĐang dùngBản nhápĐã ngừng',
      'Lesson510',
      'Problem11421',
    ])
    expect(within(table).getByRole('rowheader', { name: 'Problem' }).getAttribute('lang')).toBe(
      'en',
    )
  })

  it('shows the verification of the problem notes', () => {
    render(<CatalogStats stats={DSA} />)
    expect(
      screen.getByText(
        'Kiểm chứng lời giải: 24 đã kiểm thử · 3 chỉ biên dịch · 87 chưa có ghi chú',
      ),
    ).toBeTruthy()
  })

  it('shows no verification line for a track without problems', () => {
    const { container } = render(
      <CatalogStats
        stats={{
          trackTitle: 'Tiếng Anh',
          rows: [{ type: 'flashcard', label: 'Flashcard', active: 210, draft: 0, retired: 0 }],
          total: 210,
          verification: null,
        }}
      />,
    )
    expect(container.querySelector('[data-slot="verification"]')).toBeNull()
  })

  it('says a track has no item instead of a table of zeros (empty)', () => {
    render(
      <CatalogStats
        stats={{
          trackTitle: 'Thiết kế hệ thống',
          rows: [{ type: 'lesson', label: 'Lesson', active: 0, draft: 0, retired: 0 }],
          total: 0,
          verification: null,
        }}
      />,
    )
    expect(screen.getByText('Lộ trình này chưa có mục nào.')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })
})
