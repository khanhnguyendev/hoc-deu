import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TrackProgress } from './track-progress'

const TITLE = 'Cấu trúc dữ liệu & Giải thuật'

describe('TrackProgress (track page, Part B-M3 decision 25)', () => {
  it('shows week x of N, the introduced core items and a ring in the track accent', () => {
    render(
      <TrackProgress
        title={TITLE}
        progress={{ week: 2, weeks: 8, introduced: 20, total: 64 }}
        actions={<button type="button">Bắt đầu lại</button>}
      />,
    )
    const region = screen.getByRole('region', { name: 'Tiến độ của bạn' })
    expect(within(region).getByText('Tuần 2/8')).toBeTruthy()
    expect(within(region).getByText('20/64 bài chính đã học')).toBeTruthy()
    const ring = within(region).getByRole('progressbar', { name: `Tiến độ ${TITLE}` })
    expect(ring.getAttribute('aria-valuenow')).toBe('31')
    expect(ring.querySelector('.stroke-track')).not.toBeNull()
    expect(within(region).getByRole('button', { name: 'Bắt đầu lại' })).toBeTruthy()
  })

  it('a new learner: 0 %, week 1', () => {
    render(
      <TrackProgress title={TITLE} progress={{ week: 1, weeks: 8, introduced: 0, total: 64 }} />,
    )
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
    expect(screen.getByText('Tuần 1/8')).toBeTruthy()
    expect(screen.getByText('0/64 bài chính đã học')).toBeTruthy()
  })

  it('a variant without its roadmap yet: no week line, no count — only the ring at 0 %', () => {
    render(
      <TrackProgress title={TITLE} progress={{ week: 1, weeks: 0, introduced: 0, total: 0 }} />,
    )
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
    expect(screen.queryByText(/^Tuần/)).toBeNull()
    expect(screen.queryByText(/bài chính đã học/)).toBeNull()
  })
})
