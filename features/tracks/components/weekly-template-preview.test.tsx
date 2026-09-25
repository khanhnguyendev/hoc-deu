import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WeeklyTemplatePreview } from './weekly-template-preview'

const DSA_DAYS = [
  { label: 'Thứ 2 – Thứ 6', blocks: ['Ôn tập (tối đa 15 phút)', 'Bài mới'] },
  { label: 'Thứ 7', blocks: ['Ôn tập'] },
  { label: 'Chủ nhật', blocks: ['Phỏng vấn thử · 45 phút (từ tuần 3)', 'Ôn lại 3 bài'] },
]

const ENGLISH_THROTTLE = [
  'Tối đa 8 thẻ mới mỗi ngày',
  'Trên 40 thẻ cần ôn: 4 thẻ mới mỗi ngày',
  'Trên 60 thẻ cần ôn: tạm dừng thẻ mới',
]

describe('WeeklyTemplatePreview', () => {
  it('shows the track title as a heading, in the track accent', () => {
    const { container } = render(
      <WeeklyTemplatePreview
        title="Cấu trúc dữ liệu & Giải thuật"
        accent="track-1"
        days={DSA_DAYS}
        throttle={[]}
      />,
    )
    expect(
      screen.getByRole('heading', { level: 3, name: 'Cấu trúc dữ liệu & Giải thuật' }),
    ).toBeTruthy()
    expect(container.querySelector('[data-accent="track-1"]')).not.toBeNull()
  })

  it('lists every day with its blocks, in order', () => {
    render(<WeeklyTemplatePreview title="DSA" accent="track-1" days={DSA_DAYS} throttle={[]} />)
    const terms = screen.getAllByRole('term').map((term) => term.textContent)
    expect(terms).toEqual(['Thứ 2 – Thứ 6', 'Thứ 7', 'Chủ nhật'])
    const weekdays = screen.getAllByRole('definition')[0]!
    expect(
      within(weekdays)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Ôn tập (tối đa 15 phút)', 'Bài mới'])
  })

  it('shows no throttle section for a track without one (DSA)', () => {
    render(<WeeklyTemplatePreview title="DSA" accent="track-1" days={DSA_DAYS} throttle={[]} />)
    expect(screen.queryByText('Giới hạn thẻ mới')).toBeNull()
  })

  it('shows the throttle lines under their own label (English)', () => {
    render(
      <WeeklyTemplatePreview
        title="Tiếng Anh cho môi trường IT"
        accent="track-2"
        days={[{ label: 'Thứ 7', blocks: ['Ôn tập'] }]}
        throttle={ENGLISH_THROTTLE}
      />,
    )
    const label = screen.getByText('Giới hạn thẻ mới')
    const section = label.parentElement!
    expect(
      within(section)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(ENGLISH_THROTTLE)
  })
})
