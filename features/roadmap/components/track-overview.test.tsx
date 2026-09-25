import { render, screen, within } from '@testing-library/react'
import type * as React from 'react'
import { describe, expect, it } from 'vitest'
import type { TrackSummary } from '../queries'
import { TrackOverview } from './track-overview'

const DSA: TrackSummary = {
  id: 'dsa',
  title: 'Cấu trúc dữ liệu & Giải thuật',
  titleEn: 'Data Structures & Algorithms',
  accent: 'track-1',
  status: 'active',
}
const VARIANTS = [
  { id: '8w', label: '8 tuần', href: '/t/dsa?variant=8w', current: true },
  { id: '10w', label: '10 tuần', href: '/t/dsa?variant=10w', current: false },
]
const TEMPLATE = [{ label: 'Thứ 2 – Thứ 6', blocks: ['Ôn tập (tối đa 15 phút)', 'Bài mới'] }]

function renderOverview(props: Partial<React.ComponentProps<typeof TrackOverview>> = {}) {
  return render(
    <TrackOverview
      track={DSA}
      enrollment={{ status: 'active', roadmapVariant: '8w', budgetMinutes: 60 }}
      variants={VARIANTS}
      template={TEMPLATE}
      throttle={[]}
      {...props}
    >
      <p>Nội dung lộ trình</p>
    </TrackOverview>,
  )
}

describe('TrackOverview', () => {
  it('wraps the page in the track accent: title, English title, variants, template, content', () => {
    const { container } = renderOverview()
    const wrapper = container.querySelector('[data-slot="track-overview"]')
    expect(wrapper?.getAttribute('data-accent')).toBe('track-1')
    expect(screen.getByRole('heading', { level: 1, name: DSA.title })).toBeTruthy()
    expect(screen.getByText(DSA.titleEn).getAttribute('lang')).toBe('en')
    expect(screen.getByRole('navigation', { name: 'Phiên bản lộ trình' })).toBeTruthy()
    const template = screen.getByRole('region', { name: 'Mẫu tuần' })
    expect(within(template).getByText('Thứ 2 – Thứ 6')).toBeTruthy()
    expect(within(wrapper as HTMLElement).getByText('Nội dung lộ trình')).toBeTruthy()
  })

  it('shows the learner’s status, or a way to add the track in Settings', () => {
    renderOverview()
    expect(screen.getByText('Đang học')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Thêm trong Cài đặt' })).toBeNull()
  })

  it('offers Settings for an active track the learner does not follow', () => {
    renderOverview({ enrollment: null })
    expect(screen.getByRole('link', { name: 'Thêm trong Cài đặt' }).getAttribute('href')).toBe(
      '/settings',
    )
  })

  it('says a retired track takes no new learners, and a draft is admin-only', () => {
    const { unmount } = renderOverview({ track: { ...DSA, status: 'retired' } })
    expect(screen.getByText('Lộ trình đã ngừng — không nhận học viên mới.')).toBeTruthy()
    unmount()
    renderOverview({ track: { ...DSA, status: 'draft' }, enrollment: null })
    expect(screen.getByText('Bản nháp: chỉ quản trị viên thấy lộ trình này.')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Thêm trong Cài đặt' })).toBeNull()
  })
})
