import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TodayEmpty } from './today-empty'

describe('TodayEmpty (RF-4)', () => {
  it('not started: "Bắt đầu vào {date}" and a link to the roadmaps', () => {
    render(<TodayEmpty kind="notStarted" startDate="2026-10-03" />)
    expect(screen.getByRole('heading', { name: 'Bắt đầu vào 3 tháng 10, 2026' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Xem lộ trình' }).getAttribute('href')).toBe('/tracks')
  })

  it('no tracks: a link to /settings', () => {
    render(<TodayEmpty kind="noTracks" />)
    expect(screen.getByRole('heading', { name: 'Bạn chưa học lộ trình nào' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Mở Cài đặt' }).getAttribute('href')).toBe('/settings')
  })

  it('an empty plan: "Hôm nay không có bài nào"', () => {
    render(<TodayEmpty kind="noBlocks" />)
    expect(screen.getByRole('heading', { name: 'Hôm nay không có bài nào' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Xem lộ trình' })).toBeTruthy()
  })
})
