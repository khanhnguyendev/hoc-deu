import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ContentPage } from '@/features/admin'
import AdminContentPage, { metadata } from './page'

const PAGE: ContentPage = {
  tracks: [
    {
      id: 'dsa',
      title: 'Cấu trúc dữ liệu & Giải thuật',
      status: 'active',
      statusLabel: 'Đang dùng',
      stats: {
        trackTitle: 'Cấu trúc dữ liệu & Giải thuật',
        rows: [{ type: 'problem', label: 'Problem', active: 3, draft: 0, retired: 0 }],
        total: 3,
        verification: { tested: 1, compileOnly: 1, noNote: 1 },
      },
      roadmaps: [
        {
          trackTitle: 'Cấu trúc dữ liệu & Giải thuật',
          variant: '10w',
          variantLabel: '10 tuần',
          columns: ['notes'],
          rows: [],
          horizon: null,
          maxLearnerWeek: null,
        },
      ],
    },
  ],
  drafts: { tracks: [], items: [], notes: [] },
  redWeeks: 0,
}

vi.mock('@/features/admin', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/admin')>()),
  getAdminContent: async () => PAGE,
}))

describe('/admin/content', () => {
  it('is titled "Nội dung — Học Đều"', () => {
    expect(metadata.title).toBe('Nội dung — Học Đều')
  })

  it('renders each track (stats, coverage) and the drafts', async () => {
    render(await AdminContentPage())
    expect(screen.getByRole('heading', { level: 1, name: 'Nội dung' })).toBeTruthy()
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Cấu trúc dữ liệu & Giải thuật', 'Bản nháp'])
    expect(screen.getByRole('heading', { level: 3, name: 'Số mục' })).toBeTruthy()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Độ phủ theo tuần — 10 tuần' }),
    ).toBeTruthy()
    expect(screen.getByText('Không có bản nháp nào.')).toBeTruthy()
  })
})
