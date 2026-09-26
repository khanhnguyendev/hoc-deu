import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DSA_TITLE } from '../__tests__/fixtures'
import { WeakAreas } from './weak-areas'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('WeakAreas (§5.7)', () => {
  it('lists each weak topic as a link to its track, with its track and Weak count', () => {
    render(
      <WeakAreas
        topics={[
          {
            trackId: 'dsa',
            topicId: 'arrays-hashing',
            title: 'Arrays & Hashing',
            trackTitle: DSA_TITLE,
            count: 3,
          },
          {
            trackId: 'dsa',
            topicId: 'two-pointers',
            title: 'Two Pointers',
            trackTitle: DSA_TITLE,
            count: 2,
          },
        ]}
      />,
    )
    const region = screen.getByRole('region', { name: 'Chủ đề cần củng cố' })
    const links = within(region).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/t/dsa', '/t/dsa'])
    expect(links[0]!.textContent).toContain('Arrays & Hashing')
    expect(links[0]!.textContent).toContain(DSA_TITLE)
    expect(links[0]!.textContent).toContain('3 bài yếu')
    // Status by icon + label, never colour alone.
    expect(within(links[0]!).getByText('Yếu')).toBeTruthy()
  })

  it('keys each topic by its ID: two topics with one title both render (M5-R26)', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <WeakAreas
        topics={[
          { trackId: 'dsa', topicId: 'graphs', title: 'Graphs', trackTitle: DSA_TITLE, count: 3 },
          {
            trackId: 'dsa',
            topicId: 'advanced-graphs',
            title: 'Graphs',
            trackTitle: DSA_TITLE,
            count: 2,
          },
        ]}
      />,
    )
    expect(screen.getAllByRole('link')).toHaveLength(2)
    // React warns about a duplicate key through console.error.
    expect(errors).not.toHaveBeenCalled()
  })

  it('says there is none (empty)', () => {
    render(<WeakAreas topics={[]} />)
    const region = screen.getByRole('region', { name: 'Chủ đề cần củng cố' })
    expect(within(region).queryByRole('link')).toBeNull()
    expect(region.textContent).toContain('Chưa có chủ đề nào cần củng cố.')
  })
})
