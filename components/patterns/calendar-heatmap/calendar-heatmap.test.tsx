import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CalendarHeatmap } from '.'

const TODAY = '2026-02-04'
const DAYS = [
  { day: '2026-02-04', minutes: 45 },
  { day: '2026-02-01', minutes: 10 },
  { day: '2026-01-28', minutes: 90 },
]

function setup() {
  const user = userEvent.setup()
  const utils = render(<CalendarHeatmap days={DAYS} today={TODAY} label="Lịch học" />)
  const year = utils.container.querySelector<HTMLElement>('[data-view="year"]')!
  const month = utils.container.querySelector<HTMLElement>('[data-view="month"]')!
  const detail = () => utils.container.querySelector('[data-slot="heatmap-detail"]')?.textContent
  return { user, year, month, detail, ...utils }
}

describe('CalendarHeatmap — year view', () => {
  it('ends at today, marks it and makes it the tab stop', () => {
    const { year } = setup()
    const today = within(year).getByRole('button', { name: /^4 tháng 2, 2026/ })
    expect(today.getAttribute('aria-current')).toBe('date')
    expect(today.tabIndex).toBe(0)
    expect(today.className).toContain('ring-ring')
  })

  it('moves by a week with left/right and by a day with up/down, updating the detail line', async () => {
    const { user, year, detail } = setup()
    within(year)
      .getByRole('button', { name: /^4 tháng 2, 2026/ })
      .focus()
    await user.keyboard('{ArrowLeft}')
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^28 tháng 1, 2026/)
    expect(detail()).toContain('Thứ Tư, 28 tháng 1, 2026')
    expect(detail()).toContain('1 giờ 30 phút')
    await user.keyboard('{ArrowUp}')
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^27 tháng 1, 2026/)
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^3 tháng 2, 2026/)
  })

  it('does not repeat the focused cell through a live region', () => {
    const { container } = setup()
    const line = container.querySelector('[data-slot="heatmap-detail"]')
    expect(line?.getAttribute('aria-live')).toBeNull()
  })

  it('shows a dot on every active day and only there', () => {
    const { year } = setup()
    expect(year.querySelectorAll('[data-dot]')).toHaveLength(3)
  })

  it('never overlaps two month labels, for any start weekday (M1 #9)', () => {
    // One `today` per weekday (Monday .. Sunday): the display window can open on any weekday.
    const todays = [
      '2026-01-12',
      '2026-01-13',
      '2026-01-14',
      '2026-01-15',
      '2026-01-16',
      '2026-01-17',
      '2026-01-18',
    ]
    for (const today of todays) {
      const { container, unmount } = render(
        <CalendarHeatmap days={[]} today={today} label="Lịch học" />,
      )
      const labelled = [...container.querySelectorAll('[data-col]')]
        .filter((el) => el.textContent !== '')
        .map((el) => Number(el.getAttribute('data-col')))
      for (let i = 1; i < labelled.length; i += 1) {
        expect(labelled[i]! - labelled[i - 1]!, `today=${today}`).toBeGreaterThanOrEqual(3)
      }
      unmount()
    }
  })
})

describe('CalendarHeatmap — month view', () => {
  it('shows 44 px day cells for the current month', () => {
    const { month } = setup()
    expect(within(month).getByText('Tháng 2 năm 2026')).toBeTruthy()
    const day = within(month).getByRole('button', { name: /^4 tháng 2, 2026/ })
    expect(day.className).toContain('size-11')
    expect(day.textContent).toContain('4')
  })

  it('gives the selected day a visible state besides colour (M1 #8)', async () => {
    const { user, month } = setup()
    const selected = within(month).getByRole('button', { name: /^1 tháng 2, 2026/ })
    const other = within(month).getByRole('button', { name: /^2 tháng 2, 2026/ })
    expect(selected.className).not.toContain('ring-primary')
    await user.click(selected)
    expect(selected.getAttribute('aria-pressed')).toBe('true')
    expect(selected.className).toContain('ring-primary')
    expect(other.className).not.toContain('ring-primary')
  })

  it('still marks today distinctly when today itself is tapped (selected === today)', async () => {
    const { user, month } = setup()
    const today = within(month).getByRole('button', { name: /^4 tháng 2, 2026/ })
    await user.click(today)
    expect(today.getAttribute('aria-pressed')).toBe('true')
    expect(today.className).toContain('ring-ring')
    // Today never doubles up on the selected ring colour (a real Tailwind class conflict risk).
    expect(today.className).not.toContain('ring-primary')
  })

  it('pages months with the buttons, never past the current month', async () => {
    const { user, month } = setup()
    const next = within(month).getByRole('button', { name: 'Tháng sau' })
    expect(next).toHaveProperty('disabled', true)
    await user.click(within(month).getByRole('button', { name: 'Tháng trước' }))
    expect(within(month).getByText('Tháng 1 năm 2026')).toBeTruthy()
    await user.click(next)
    expect(within(month).getByText('Tháng 2 năm 2026')).toBeTruthy()
  })

  it('pages months with a horizontal swipe', () => {
    const { month } = setup()
    const grid = within(month).getByRole('group', { name: 'Lịch học' })
    fireEvent.pointerDown(grid, { clientX: 100, clientY: 10 })
    fireEvent.pointerUp(grid, { clientX: 220, clientY: 12 })
    expect(within(month).getByText('Tháng 1 năm 2026')).toBeTruthy()
  })

  it('shows the minutes of a tapped day', async () => {
    const { user, month, detail } = setup()
    await user.click(within(month).getByRole('button', { name: /^1 tháng 2, 2026/ }))
    expect(detail()).toContain('10 phút')
  })
})

describe('CalendarHeatmap — legend and table', () => {
  it('has a five-level legend', () => {
    setup()
    const legend = screen.getByRole('list', { name: 'Chú giải' })
    expect(within(legend).getAllByRole('listitem')).toHaveLength(5)
  })

  it('toggles a table of the active days', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Xem dạng bảng' }))
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((r) => r.textContent)).toEqual([
      '4 tháng 2, 202645 phút',
      '1 tháng 2, 202610 phút',
      '28 tháng 1, 20261 giờ 30 phút',
    ])
    expect(screen.getByRole('button', { name: 'Ẩn bảng' }).getAttribute('aria-expanded')).toBe(
      'true',
    )
  })

  it('renders with no activity at all (M1 #22: the catalog’s empty demo)', async () => {
    const user = userEvent.setup()
    const { container } = render(<CalendarHeatmap days={[]} today={TODAY} label="Lịch học" />)
    const month = container.querySelector<HTMLElement>('[data-view="month"]')!
    expect(within(month).getByRole('button', { name: /^4 tháng 2, 2026/ })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Xem dạng bảng' }))
    expect(screen.getByText('Chưa có ngày học nào.')).toBeTruthy()
  })
})
