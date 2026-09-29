import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { levelFor } from '@/components/patterns/calendar-heatmap/levels'
import { TodayPreview } from './today-preview'

describe('TodayPreview', () => {
  it('is a figure named by its visible caption', () => {
    render(<TodayPreview />)
    const figure = screen.getByRole('figure', { name: 'Ví dụ: một ngày 45 phút' })
    expect(within(figure).getByText('Ví dụ: một ngày 45 phút').tagName).toBe('FIGCAPTION')
  })

  it('shows the three blocks with their items, English content tagged lang="en"', () => {
    const { container } = render(<TodayPreview />)
    const blocks = container.querySelectorAll('[data-slot="preview-block"]')
    expect([...blocks].map((b) => b.getAttribute('data-accent'))).toEqual([
      'track-1',
      'track-1',
      'track-2',
    ])
    for (const term of ['Two Pointers', 'Valid Palindrome', 'Two Sum', 'Tickets and bug reports']) {
      expect(screen.getByText(term).getAttribute('lang')).toBe('en')
    }
    for (const kind of ['Bài mới', 'Ôn tập', 'Thẻ mới']) expect(screen.getByText(kind)).toBeTruthy()
    expect(screen.getByText('Thứ Tư, 16/09')).toBeTruthy()
  })

  it('shows the first block checked in with the real "Xong" pill', () => {
    const { container } = render(<TodayPreview />)
    const pills = container.querySelectorAll('[data-slot="status-pill"]')
    expect(pills).toHaveLength(1)
    expect(pills[0]?.getAttribute('data-status')).toBe('block-done')
    expect(pills[0]?.textContent).toBe('Xong')
  })

  it('has nothing interactive inside the figure', () => {
    render(<TodayPreview />)
    const figure = screen.getByRole('figure')
    expect(within(figure).queryAllByRole('link')).toHaveLength(0)
    expect(within(figure).queryAllByRole('button')).toHaveLength(0)
    expect(figure.querySelectorAll('a, button, input, select, textarea, [tabindex]')).toHaveLength(
      0,
    )
  })

  it('keeps the 7-day strip decorative, today outlined and deepened, with the meaning as text', () => {
    const { container } = render(<TodayPreview />)
    const cells = container.querySelectorAll('[data-slot="heat-cell"]')
    expect(cells).toHaveLength(7)
    for (const cell of cells) expect(cell.closest('[aria-hidden="true"]')).not.toBeNull()
    const today = cells[2] as HTMLElement
    expect(today.className).toContain('outline-2')
    // Today fills to the level of the minutes checked in on the first block (20).
    expect(today.getAttribute('data-level')).toBe(String(levelFor(20)))
    expect(today.querySelector('.landing-deepen')).not.toBeNull()
    expect(screen.getByText(/hôm nay mới xong 20 phút/).className).toContain('sr-only')
  })

  it('plays the pill motion from a visible end state (CSS animation, no script)', () => {
    const { container } = render(<TodayPreview />)
    expect(container.querySelector('.landing-settle')).not.toBeNull()
  })
})
