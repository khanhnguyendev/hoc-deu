import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DSA_TITLE, ENGLISH_TITLE, trackView } from '../__tests__/fixtures'
import { TodayStats } from './today-stats'

describe('TodayStats', () => {
  it('shows the streak, the due reviews linking to /review, and a ring per track', () => {
    render(
      <TodayStats
        streak={12}
        tracks={[
          trackView({ dueCount: 3, week: 2, weeks: 8, progress: 0.25 }),
          trackView({
            trackId: 'english',
            title: ENGLISH_TITLE,
            accent: 'track-2',
            dueCount: 9,
            week: 1,
            weeks: 10,
            progress: 0.05,
          }),
        ]}
      />,
    )
    const region = screen.getByRole('region', { name: 'Tiến độ' })
    expect(region.textContent).toContain('12 ngày liên tiếp')
    const due = within(region).getByRole('link', { name: /Cần ôn hôm nay/ })
    expect(due.getAttribute('href')).toBe('/review')
    expect(due.textContent).toContain('12')

    const dsa = within(region).getByRole('progressbar', { name: `Tiến độ ${DSA_TITLE}` })
    expect(dsa.getAttribute('aria-valuenow')).toBe('25')
    expect(dsa.closest('[data-accent]')?.getAttribute('data-accent')).toBe('track-1')
    expect(region.textContent).toContain('Tuần 2/8 · 3 mục cần ôn')
    const english = within(region).getByRole('progressbar', { name: `Tiến độ ${ENGLISH_TITLE}` })
    expect(english.getAttribute('aria-valuenow')).toBe('5')
    expect(region.textContent).toContain('Tuần 1/10 · 9 mục cần ôn')
  })

  it('a new learner (empty): streak 0, nothing due, rings at 0 %', () => {
    render(<TodayStats streak={0} tracks={[trackView({ dueCount: 0, progress: 0, week: 1 })]} />)
    const region = screen.getByRole('region', { name: 'Tiến độ' })
    expect(region.textContent).toContain('0 ngày liên tiếp')
    expect(within(region).getByRole('link', { name: /Cần ôn hôm nay/ }).textContent).toContain('0')
    expect(within(region).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
  })

  it('leaves the week out for a track without its roadmap (weeks 0)', () => {
    render(<TodayStats streak={1} tracks={[trackView({ weeks: 0, week: 1, dueCount: 2 })]} />)
    const region = screen.getByRole('region', { name: 'Tiến độ' })
    expect(region.textContent).not.toContain('Tuần')
    expect(region.textContent).toContain('2 mục cần ôn')
  })

  it('with no active track, shows the streak and due reviews only', () => {
    render(<TodayStats streak={3} tracks={[]} />)
    expect(screen.queryByRole('progressbar')).toBeNull()
  })
})
