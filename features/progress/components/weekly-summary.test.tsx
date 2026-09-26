import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { weeklySummary } from '@/lib/domain/stats/weeklySummary'
import type { DailyActivity } from '@/lib/domain/state'
import type { LocalDay } from '@/lib/domain/time/localDay'
import { WeeklySummary } from './weekly-summary'

const activity = (
  localDay: LocalDay,
  change: Partial<DailyActivity> = {},
): [LocalDay, DailyActivity] => [
  localDay,
  { localDay, minutesByTrack: {}, itemsDone: 0, completed: false, ...change },
]

const TRACKS = [
  { id: 'dsa', title: 'Cấu trúc dữ liệu & Giải thuật', accent: 'track-1' },
  { id: 'english', title: 'Tiếng Anh cho môi trường IT', accent: 'track-2' },
]

describe('WeeklySummary', () => {
  it('shows a bar per track (accent, value label) and the per-day list', () => {
    const days = Object.fromEntries([
      activity('2026-09-28', {
        minutesByTrack: { dsa: 40, english: 10 },
        itemsDone: 3,
        completed: true,
      }),
      activity('2026-09-29', { minutesByTrack: { dsa: 20 }, itemsDone: 1, completed: false }),
    ])
    const week = weeklySummary(days, '2026-09-28', new Set(['dsa', 'english']))
    const { container } = render(<WeeklySummary week={week} tracks={TRACKS} />)

    expect(screen.getByRole('heading', { name: 'Tổng kết tuần' })).toBeTruthy()
    expect(screen.getByText('28/09 – 04/10')).toBeTruthy()

    const dsaBar = container.querySelector<HTMLElement>('[data-accent="track-1"]')!
    expect(within(dsaBar).getByText('Cấu trúc dữ liệu & Giải thuật')).toBeTruthy()
    expect(within(dsaBar).getByText('1 giờ')).toBeTruthy() // 40 + 20 = 60 minutes
    expect(within(dsaBar).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100') // busiest track

    const englishBar = container.querySelector<HTMLElement>('[data-accent="track-2"]')!
    expect(within(englishBar).getByText('10 phút')).toBeTruthy()

    // Per-day list: 28/09 done (Check), 29/09 not done (Circle) — never colour alone.
    expect(screen.getAllByText('Đã học')).toHaveLength(1)
    expect(screen.getAllByText('Chưa học')).toHaveLength(6)
  })

  it('shows a message instead of bars when the learner follows no track', () => {
    const week = weeklySummary({}, '2026-09-28', new Set())
    render(<WeeklySummary week={week} tracks={[]} />)
    expect(screen.getByText('Bạn chưa theo lộ trình nào')).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })
})
