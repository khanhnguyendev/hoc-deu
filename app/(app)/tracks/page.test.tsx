import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TracksOverview } from '@/features/roadmap'
import TracksPage, { metadata } from './page'

const state = vi.hoisted(() => ({ overview: null as unknown as TracksOverview }))

vi.mock('@/features/roadmap', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/roadmap')>()),
  getTracksOverview: async () => state.overview,
}))

const DSA = {
  id: 'dsa',
  title: 'Cấu trúc dữ liệu & Giải thuật',
  titleEn: 'Data Structures & Algorithms',
  accent: 'track-1',
  status: 'active' as const,
}

beforeEach(() => {
  state.overview = {
    isAdmin: false,
    mine: [
      { track: DSA, enrollment: { status: 'active', roadmapVariant: '8w', budgetMinutes: 60 } },
    ],
    others: [],
  }
})

describe('/tracks', () => {
  it('is titled "Lộ trình — Học Đều"', () => {
    expect(metadata.title).toBe('Lộ trình — Học Đều')
  })

  it('shows the page header and the learner’s tracks', async () => {
    render(await TracksPage())
    expect(screen.getByRole('heading', { level: 1, name: 'Lộ trình' })).toBeTruthy()
    expect(screen.getByText('Các lộ trình bạn đang học và các lộ trình khác.')).toBeTruthy()
    const mine = screen.getByRole('region', { name: 'Lộ trình của bạn' })
    expect(within(mine).getByRole('article', { name: DSA.title })).toBeTruthy()
    expect(within(mine).getByText('8 tuần')).toBeTruthy()
  })

  it('[RF-4] shows an empty state when there is no active track at all', async () => {
    state.overview = { isAdmin: false, mine: [], others: [] }
    render(await TracksPage())
    expect(screen.getByRole('heading', { level: 1, name: 'Lộ trình' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Chưa có lộ trình nào' })).toBeTruthy()
  })
})
