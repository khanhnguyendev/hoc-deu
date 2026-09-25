import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PracticeCard } from './practice-card'

describe('PracticeCard', () => {
  it('links to the problem with its LeetCode number, English title and difficulty', () => {
    render(<PracticeCard title="3Sum" href="/t/dsa/items/lc-0015" leetcode={15} difficulty="M" />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/t/dsa/items/lc-0015')
    expect(link.textContent).toContain('Bài luyện tập')
    expect(link.textContent).toContain('#15')
    expect(link.textContent).toContain('Trung bình')
    expect(screen.getByText('3Sum').closest('[lang="en"]')).not.toBeNull()
  })

  it.each([
    ['E', 'Dễ'],
    ['H', 'Khó'],
  ] as const)('labels difficulty %s as %s (text, not colour alone)', (difficulty, label) => {
    render(<PracticeCard title="x" href="/x" leetcode={1} difficulty={difficulty} />)
    expect(screen.getByRole('link').textContent).toContain(label)
  })

  it('omits the number and difficulty when they are unknown', () => {
    render(<PracticeCard title="Custom" href="/x" leetcode={null} difficulty={null} />)
    const text = screen.getByRole('link').textContent ?? ''
    expect(text).not.toContain('#')
    for (const label of ['Dễ', 'Trung bình', 'Khó']) expect(text).not.toContain(label)
  })
})
