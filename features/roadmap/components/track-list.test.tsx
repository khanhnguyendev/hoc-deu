import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TrackSummary } from '../queries'
import { TrackList } from './track-list'

const track = (id: string, title: string, accent: string): TrackSummary => ({
  id,
  title,
  titleEn: `${title} (en)`,
  accent,
  status: 'active',
})
const DSA = track('dsa', 'Cấu trúc dữ liệu & Giải thuật', 'track-1')
const ENGLISH = track('english', 'Tiếng Anh cho môi trường IT', 'track-2')

const region = (name: string) => screen.getByRole('region', { name })

describe('TrackList', () => {
  it('lists the learner’s tracks under "Lộ trình của bạn" and the rest under "Lộ trình khác"', () => {
    render(
      <TrackList
        mine={[
          { track: DSA, enrollment: { status: 'active', roadmapVariant: '8w', budgetMinutes: 60 } },
        ]}
        others={[ENGLISH]}
      />,
    )
    expect(
      within(region('Lộ trình của bạn')).getByRole('article', { name: DSA.title }),
    ).toBeTruthy()
    const others = region('Lộ trình khác')
    expect(within(others).getByRole('article', { name: ENGLISH.title })).toBeTruthy()
    expect(within(others).getByRole('link', { name: 'Thêm trong Cài đặt' })).toBeTruthy()
  })

  it('says so when the learner already follows every track', () => {
    render(
      <TrackList
        mine={[
          { track: DSA, enrollment: { status: 'active', roadmapVariant: '8w', budgetMinutes: 60 } },
        ]}
        others={[]}
      />,
    )
    expect(
      within(region('Lộ trình khác')).getByText('Bạn đang học tất cả lộ trình hiện có.'),
    ).toBeTruthy()
  })

  it('[RF-4] shows an empty state with a way to Settings when the learner follows none', () => {
    render(<TrackList mine={[]} others={[DSA, ENGLISH]} />)
    const mine = region('Lộ trình của bạn')
    expect(within(mine).getByRole('heading', { name: 'Bạn chưa học lộ trình nào' })).toBeTruthy()
    expect(within(mine).getByRole('link', { name: 'Mở Cài đặt' }).getAttribute('href')).toBe(
      '/settings',
    )
    expect(within(region('Lộ trình khác')).getAllByRole('article')).toHaveLength(2)
  })

  it('[RF-4] shows one empty state and no sections when there is no track at all', () => {
    render(<TrackList mine={[]} others={[]} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Chưa có lộ trình nào' })).toBeTruthy()
    expect(screen.getByText('Các lộ trình sẽ xuất hiện ở đây khi được mở.')).toBeTruthy()
    expect(screen.queryByRole('region')).toBeNull()
  })
})
