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
  it('is the week’s section: its title, the stat cards with neutral labels, the bars per track', () => {
    const days = Object.fromEntries([
      activity('2026-09-28', {
        minutesByTrack: { dsa: 40, english: 10 },
        itemsDone: 3,
        completed: true,
      }),
      activity('2026-09-29', { minutesByTrack: { dsa: 20 }, itemsDone: 1, completed: false }),
    ])
    const week = weeklySummary(days, '2026-09-28', new Set(['dsa', 'english']))
    const { container } = render(
      <WeeklySummary week={week} tracks={TRACKS} title="Tuần trước · 28/09 – 04/10" />,
    )
    const section = screen.getByRole('region', { name: 'Tuần trước · 28/09 – 04/10' })
    // UI I-4: the cards say what they count, the section says which week.
    expect(within(section).getByText('Phút').closest('[data-slot="stat-card"]')?.textContent).toBe(
      'Phút70',
    )
    expect(
      within(section).getByText('Ngày hoàn thành').closest('[data-slot="stat-card"]')?.textContent,
    ).toBe('Ngày hoàn thành1')
    expect(
      within(section).getByText('Mục đã học').closest('[data-slot="stat-card"]')?.textContent,
    ).toBe('Mục đã học4')
    expect(section.textContent).not.toContain('tuần này')

    const dsaBar = container.querySelector<HTMLElement>('[data-accent="track-1"]')!
    expect(within(dsaBar).getByText('Cấu trúc dữ liệu & Giải thuật')).toBeTruthy()
    expect(within(dsaBar).getByText('1 giờ')).toBeTruthy() // 40 + 20 = 60 minutes
    expect(within(dsaBar).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100') // busiest track
    const englishBar = container.querySelector<HTMLElement>('[data-accent="track-2"]')!
    expect(within(englishBar).getByText('10 phút')).toBeTruthy()
  })

  it('lists each day by its weekday: completed or not — never "Chưa học" beside studied minutes (UI I-4)', () => {
    const days = Object.fromEntries([
      activity('2026-09-28', { minutesByTrack: { dsa: 40 }, completed: true }),
      activity('2026-09-29', { minutesByTrack: { dsa: 25 }, completed: false }),
    ])
    const week = weeklySummary(days, '2026-09-28', new Set(['dsa']))
    render(<WeeklySummary week={week} tracks={TRACKS} title="Tuần này · 28/09 – 04/10" />)
    const list = screen.getByRole('list', { name: 'Theo ngày' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(7)
    expect(rows[0]!.textContent).toBe('Thứ Hai, 28/0940 phútHoàn thành')
    expect(rows[1]!.textContent).toBe('Thứ Ba, 29/0925 phútChưa hoàn thành')
    expect(rows[6]!.textContent).toContain('Chủ Nhật, 04/10')
    expect(list.textContent).not.toContain('Chưa học')
    expect(within(list).getAllByText('Hoàn thành')).toHaveLength(1)
    expect(within(list).getAllByText('Chưa hoàn thành')).toHaveLength(6)
  })

  it('puts the week navigation above the cards', () => {
    const week = weeklySummary({}, '2026-09-28', new Set(['dsa']))
    render(
      <WeeklySummary
        week={week}
        tracks={TRACKS}
        title="Tuần này · 28/09 – 04/10"
        nav={<nav aria-label="Điều hướng tuần">…</nav>}
      />,
    )
    const nav = screen.getByRole('navigation', { name: 'Điều hướng tuần' })
    const minutes = screen.getByText('Phút')
    expect(Boolean(nav.compareDocumentPosition(minutes) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
      true,
    )
  })

  it('shows a message instead of bars when the learner follows no track', () => {
    const week = weeklySummary({}, '2026-09-28', new Set())
    render(<WeeklySummary week={week} tracks={[]} title="Tuần này · 28/09 – 04/10" />)
    expect(screen.getByText('Bạn chưa theo lộ trình nào')).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })
})
