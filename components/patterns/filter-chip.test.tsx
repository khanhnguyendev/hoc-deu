import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { FilterChip, FilterChipGroup } from './filter-chip'

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
