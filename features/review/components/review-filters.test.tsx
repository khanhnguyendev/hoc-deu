import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReviewFilters } from './review-filters'

const TRACKS = [
  { id: 'dsa', title: 'Cấu trúc dữ liệu & Giải thuật', count: 3 },
  { id: 'english', title: 'Tiếng Anh cho môi trường IT', count: 5 },
]

describe('ReviewFilters (task 5.3)', () => {
  it('is a labelled navigation of "Tất cả" plus one link per track, with its count', () => {
    render(<ReviewFilters tracks={TRACKS} active={null} />)
    const nav = screen.getByRole('navigation', { name: 'Lọc theo lộ trình' })
    const all = screen.getByRole('link', { name: 'Tất cả 8' })
    const dsa = screen.getByRole('link', { name: 'Cấu trúc dữ liệu & Giải thuật 3' })
    const english = screen.getByRole('link', { name: 'Tiếng Anh cho môi trường IT 5' })
    expect(nav.contains(all)).toBe(true)
    expect(nav.contains(dsa)).toBe(true)
    expect(nav.contains(english)).toBe(true)
    expect(all.getAttribute('href')).toBe('/review')
    expect(dsa.getAttribute('href')).toBe('/review?track=dsa')
  })

  it('marks the active track current, "Tất cả" when none is active', () => {
    render(<ReviewFilters tracks={TRACKS} active="dsa" />)
    expect(screen.getByRole('link', { name: /Cấu trúc/ }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: /Tất cả/ }).getAttribute('aria-current')).toBeNull()
  })

  it('marks "Tất cả" current when no track is active', () => {
    render(<ReviewFilters tracks={TRACKS} active={null} />)
    expect(screen.getByRole('link', { name: /Tất cả/ }).getAttribute('aria-current')).toBe('page')
  })
})
