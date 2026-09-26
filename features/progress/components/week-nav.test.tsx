import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WeekNav } from './week-nav'

describe('WeekNav', () => {
  it('links to the previous and next week through ?week=', () => {
    render(<WeekNav previousWeek="2026-09-07" nextWeek="2026-09-21" />)
    const nav = screen.getByRole('navigation', { name: 'Điều hướng tuần' })
    expect(nav.querySelector('a[href="/progress?week=2026-09-07"]')).toBeTruthy()
    expect(nav.querySelector('a[href="/progress?week=2026-09-21"]')).toBeTruthy()
  })

  it('disables — never hides — "Tuần sau" at the current week', () => {
    render(<WeekNav previousWeek="2026-09-21" nextWeek={null} />)
    const next = screen.getByRole('button', { name: 'Tuần sau' })
    expect(next).toHaveProperty('disabled', true)
    expect(screen.queryByRole('link', { name: 'Tuần sau' })).toBeNull()
  })

  it('gives every control a 44 px touch target (h-11, size="md"), not the 36 px desktop-only size', () => {
    const { rerender } = render(<WeekNav previousWeek="2026-09-07" nextWeek="2026-09-21" />)
    for (const name of ['Tuần trước', 'Tuần sau']) {
      const control = screen.getByRole('link', { name })
      expect(control.className).toContain('h-11')
      expect(control.className).not.toContain('h-9')
    }
    rerender(<WeekNav previousWeek="2026-09-21" nextWeek={null} />)
    const disabledNext = screen.getByRole('button', { name: 'Tuần sau' })
    expect(disabledNext.className).toContain('h-11')
    expect(disabledNext.className).not.toContain('h-9')
  })
})
