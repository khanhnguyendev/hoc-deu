import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Enrollment, TrackSummary } from '../queries'
import { TrackCard } from './track-card'

const DSA: TrackSummary = {
  id: 'dsa',
  title: 'Cấu trúc dữ liệu & Giải thuật',
  titleEn: 'Data Structures & Algorithms',
  accent: 'track-1',
  status: 'active',
}
const ACTIVE: Enrollment = { status: 'active', roadmapVariant: '8w', budgetMinutes: 60 }

const card = () => screen.getByRole('article', { name: DSA.title })

describe('TrackCard', () => {
  it('shows an enrolled track: accent chip, title, status, variant, minutes and "Xem lộ trình"', () => {
    const { container } = render(<TrackCard track={DSA} enrollment={ACTIVE} />)
    expect(container.querySelector('[data-accent="track-1"]')).not.toBeNull()
    expect(screen.getByRole('heading', { level: 3, name: DSA.title })).toBeTruthy()
    const chip = within(card()).getByText('Data Structures & Algorithms')
    expect(chip.getAttribute('lang')).toBe('en')
    expect(within(card()).getByText('Đang học')).toBeTruthy()
    expect(within(card()).getByText('8 tuần')).toBeTruthy()
    expect(within(card()).getByText('60 phút mỗi ngày')).toBeTruthy()
    const view = within(card()).getByRole('link', { name: /^Xem lộ trình/ })
    expect(view.getAttribute('href')).toBe('/t/dsa')
    // The link names its track for screen readers' link lists.
    expect(view.textContent).toContain(DSA.title)
    expect(within(card()).queryByRole('link', { name: 'Thêm trong Cài đặt' })).toBeNull()
  })

  it('says "Tạm dừng" for a paused enrollment', () => {
    render(<TrackCard track={DSA} enrollment={{ ...ACTIVE, status: 'paused' }} />)
    expect(within(card()).getByText('Tạm dừng')).toBeTruthy()
    expect(within(card()).queryByText('Đang học')).toBeNull()
  })

  it('offers another active track through Settings', () => {
    render(<TrackCard track={DSA} enrollment={null} />)
    expect(
      within(card()).getByRole('link', { name: 'Thêm trong Cài đặt' }).getAttribute('href'),
    ).toBe('/settings')
    expect(within(card()).getByRole('link', { name: /^Xem lộ trình/ })).toBeTruthy()
    expect(within(card()).queryByText('Đang học')).toBeNull()
    expect(within(card()).queryByText('8 tuần')).toBeNull()
  })

  it('marks a draft track "Bản nháp" (admins) and does not offer it in Settings', () => {
    render(<TrackCard track={{ ...DSA, status: 'draft' }} enrollment={null} />)
    expect(within(card()).getByText('Bản nháp')).toBeTruthy()
    expect(within(card()).queryByRole('link', { name: 'Thêm trong Cài đặt' })).toBeNull()
  })

  it('tells an enrolled learner that a retired track takes no new learners', () => {
    render(<TrackCard track={{ ...DSA, status: 'retired' }} enrollment={ACTIVE} />)
    expect(within(card()).getByText('Lộ trình đã ngừng — không nhận học viên mới.')).toBeTruthy()
    expect(within(card()).getByRole('link', { name: /^Xem lộ trình/ })).toBeTruthy()
  })
})
