import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { progressPercent, TrackProgressCard, weekOfWeeks } from './track-progress-card'

const TITLE = 'Cấu trúc dữ liệu & Giải thuật'

describe('TrackProgressCard (m-1: the one ring-and-week card)', () => {
  it('a ring in the track accent named "Tiến độ {title}", its headline and facts', () => {
    const { container } = render(
      <TrackProgressCard
        title={TITLE}
        accent="track-1"
        progress={{ week: 2, weeks: 8, introduced: 20, total: 64 }}
        headline={TITLE}
        facts={['Tuần 2/8', null, '3 mục cần ôn']}
      />,
    )
    const ring = screen.getByRole('progressbar', { name: `Tiến độ ${TITLE}` })
    expect(ring.getAttribute('aria-valuenow')).toBe('31')
    expect(ring.closest('[data-accent]')?.getAttribute('data-accent')).toBe('track-1')
    expect(container.textContent).toContain('Tuần 2/8 · 3 mục cần ôn')
  })

  it('size lg: the large ring, the actions beside it', () => {
    render(
      <TrackProgressCard
        title={TITLE}
        progress={{ week: 1, weeks: 8, introduced: 0, total: 64 }}
        size="lg"
        headline="Tuần 1/8"
        facts={['0/64 bài chính đã học']}
        actions={<button type="button">Bắt đầu lại</button>}
      />,
    )
    expect(screen.getByRole('progressbar').className).toContain('size-24')
    expect(screen.getByText('Tuần 1/8').className).toContain('text-lg')
    expect(screen.getByRole('button', { name: 'Bắt đầu lại' })).toBeTruthy()
  })

  it('weekOfWeeks / progressPercent: nothing without a roadmap, never NaN', () => {
    expect(weekOfWeeks({ week: 2, weeks: 8, introduced: 1, total: 4 })).toBe('Tuần 2/8')
    expect(weekOfWeeks({ week: 1, weeks: 0, introduced: 0, total: 0 })).toBeNull()
    expect(progressPercent({ week: 1, weeks: 0, introduced: 0, total: 0 })).toBe(0)
    expect(progressPercent({ week: 1, weeks: 8, introduced: 1, total: 4 })).toBe(25)
  })
})
