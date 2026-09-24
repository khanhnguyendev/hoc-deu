import { render, screen } from '@testing-library/react'
import { Clock } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { PageHeader } from './page-header'
import { ProgressRing } from './progress-ring'
import { Section } from './section'
import { StatCard } from './stat-card'
import { StreakBadge } from './streak-badge'

describe('PageHeader', () => {
  it('renders one h1, the description and the actions', () => {
    render(
      <PageHeader
        title="Hôm nay học gì?"
        description="Thứ Ba, 3 tháng 2"
        actions={<button type="button">Học thêm</button>}
      />,
    )
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([
      'Hôm nay học gì?',
    ])
    expect(screen.getByText('Thứ Ba, 3 tháng 2')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Học thêm' })).toBeTruthy()
  })
})

describe('Section', () => {
  it('is a region named by its h2', () => {
    render(
      <Section title="Ôn tập đến hạn">
        <p>24 thẻ</p>
      </Section>,
    )
    const region = screen.getByRole('region', { name: 'Ôn tập đến hạn' })
    expect(region.querySelector('h2')?.textContent).toBe('Ôn tập đến hạn')
    expect(region.textContent).toContain('24 thẻ')
  })
})

describe('StatCard', () => {
  it('prints the label and the value with vi-VN digits', () => {
    render(<StatCard label="Phút tuần này" value={1234} icon={Clock} hint="+12%" />)
    expect(screen.getByText('Phút tuần này')).toBeTruthy()
    const value = screen.getByText('1.234')
    expect(value.className).toContain('font-mono')
    expect(value.className).toContain('tabular-nums')
  })
})

describe('StreakBadge', () => {
  it('shows the flame, the number and the suffix', () => {
    const { container } = render(<StreakBadge days={12} />)
    expect(container.textContent?.replace(/\s+/g, ' ').trim()).toBe('12 ngày liên tiếp')
    expect(container.querySelector('svg.lucide-flame')?.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('ProgressRing', () => {
  it('exposes a labelled progressbar with its value', () => {
    render(<ProgressRing value={40} label="Tiến độ DSA" tone="track" />)
    const ring = screen.getByRole('progressbar', { name: 'Tiến độ DSA' })
    expect(ring.getAttribute('aria-valuenow')).toBe('40')
    expect(ring.textContent).toBe('40%')
    expect(ring.querySelector('.stroke-track')).not.toBeNull()
  })

  it.each([
    [150, '100'],
    [-1, '0'],
  ])('clamps %i to %s', (value, expected) => {
    render(<ProgressRing value={value} label="Tổng" />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(expected)
  })
})
