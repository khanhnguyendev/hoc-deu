import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { FilterChip, FilterChipGroup, FilterChipLink } from './filter-chip'

function Example() {
  const [weak, setWeak] = useState(false)
  return (
    <FilterChipGroup label="Lọc theo trạng thái">
      <FilterChip status="weak" pressed={weak} onPressedChange={setWeak} />
      <FilterChip status="mastered" pressed={false} onPressedChange={() => {}} />
    </FilterChipGroup>
  )
}

describe('FilterChip', () => {
  it('is a toggle button labelled by its status, in a labelled group', async () => {
    render(<Example />)
    const group = screen.getByRole('group', { name: 'Lọc theo trạng thái' })
    const weak = screen.getByRole('button', { name: 'Yếu' })
    expect(group.contains(weak)).toBe(true)
    expect(weak.getAttribute('aria-pressed')).toBe('false')
    await userEvent.setup().click(weak)
    expect(weak.getAttribute('aria-pressed')).toBe('true')
  })

  it('is 32 px tall with an expanded 44 px hit area', () => {
    render(<Example />)
    const chip = screen.getByRole('button', { name: 'Yếu' })
    expect(chip.className).toContain('h-8')
    expect(chip.className).toContain('before:-inset-y-2')
  })
})

describe('FilterChipLink', () => {
  function Links({ current }: { current: string }) {
    return (
      <FilterChipGroup as="nav" label="Lọc theo lộ trình">
        <FilterChipLink href="/review" label="Tất cả" count={8} current={current === 'all'} />
        <FilterChipLink
          href="/review?track=dsa"
          label="DSA"
          count={3}
          current={current === 'dsa'}
        />
      </FilterChipGroup>
    )
  }

  it('is a labelled navigation of real links, named by their label and count', () => {
    render(<Links current="all" />)
    const nav = screen.getByRole('navigation', { name: 'Lọc theo lộ trình' })
    const all = screen.getByRole('link', { name: 'Tất cả 8' })
    const dsa = screen.getByRole('link', { name: 'DSA 3' })
    expect(nav.contains(all)).toBe(true)
    expect(nav.contains(dsa)).toBe(true)
    expect(all.getAttribute('href')).toBe('/review')
    expect(dsa.getAttribute('href')).toBe('/review?track=dsa')
  })

  it('marks the one in force with aria-current="page", the others with none', () => {
    render(<Links current="dsa" />)
    expect(screen.getByRole('link', { name: 'DSA 3' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Tất cả 8' }).getAttribute('aria-current')).toBeNull()
  })

  it('shares the toggle chip’s pill shape and 44 px hit area (no drift, I4)', () => {
    render(<Links current="all" />)
    const link = screen.getByRole('link', { name: 'Tất cả 8' })
    expect(link.className).toContain('h-8')
    expect(link.className).toContain('before:-inset-y-2')
  })
})
