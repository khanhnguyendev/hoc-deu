import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { weeklySummary } from '@/lib/domain/stats/weeklySummary'
import type { ProgressPage } from '../view-model'
import { ProgressView } from './progress-view'

const EMPTY_WEEK = weeklySummary({}, '2026-09-28', new Set())

const BASE_PAGE: ProgressPage = {
  today: '2026-09-28',
  heatmap: [],
  streak: 0,
  week: EMPTY_WEEK,
  previousWeek: '2026-09-21',
  nextWeek: null,
  tracks: [],
}

describe('ProgressView', () => {
  it('shows the empty state when there is no activity at all (RF-4)', () => {
    render(<ProgressView page={BASE_PAGE} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Tiến độ' })).toBeTruthy()
    expect(screen.getByText('Chưa có ngày học nào — bắt đầu từ trang Hôm nay')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Hôm nay' }).getAttribute('href')).toBe('/today')
    expect(screen.queryByRole('navigation', { name: 'Điều hướng tuần' })).toBeNull()
  })

  it('shows the streak, stat cards, heatmap, week nav and weekly summary when there is activity', () => {
    const page: ProgressPage = {
      ...BASE_PAGE,
      streak: 5,
      heatmap: [{ day: '2026-09-28', minutes: 45 }],
      week: weeklySummary(
        {
          '2026-09-28': {
            localDay: '2026-09-28',
            minutesByTrack: { dsa: 45 },
            itemsDone: 2,
            completed: true,
          },
        },
        '2026-09-28',
        new Set(['dsa']),
      ),
      tracks: [{ id: 'dsa', title: 'Cấu trúc dữ liệu & Giải thuật', accent: 'track-1' }],
    }
    const { container } = render(<ProgressView page={page} />)
    expect(container.querySelector('[data-slot="streak-badge"]')?.textContent).toContain('5')
    expect(screen.getByText('Phút tuần này')).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Điều hướng tuần' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Tổng kết tuần' })).toBeTruthy()
    expect(screen.queryByText('Chưa có ngày học nào — bắt đầu từ trang Hôm nay')).toBeNull()
  })
})
