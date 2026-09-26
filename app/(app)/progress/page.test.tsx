import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { weeklySummary } from '@/lib/domain/stats/weeklySummary'
import type { ProgressPage as ProgressPageData } from '@/features/progress'
import ProgressPage, { metadata } from './page'

const state = vi.hoisted(() => ({
  page: null as unknown as ProgressPageData,
  calls: [] as unknown[][],
}))

vi.mock('@/features/progress', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/progress')>()),
  getProgress: async (week: string | undefined) => {
    state.calls.push(['getProgress', week])
    return state.page
  },
}))

const BASE: ProgressPageData = {
  today: '2026-09-28',
  heatmap: [],
  streak: 0,
  week: weeklySummary({}, '2026-09-28', new Set()),
  previousWeek: '2026-09-21',
  nextWeek: null,
  tracks: [],
}

const props = (search: Record<string, string | string[]> = {}) => ({
  params: Promise.resolve({}),
  searchParams: Promise.resolve(search),
})

beforeEach(() => {
  state.page = BASE
  state.calls = []
})

describe('/progress', () => {
  it('is titled "Tiến độ — Học Đều"', () => {
    expect(metadata.title).toBe('Tiến độ — Học Đều')
  })

  it('reads ?week= as a single value and passes it to getProgress', async () => {
    await ProgressPage(props({ week: '2026-09-14' }))
    expect(state.calls).toEqual([['getProgress', '2026-09-14']])
  })

  it('passes undefined for a missing or multi-valued ?week=', async () => {
    await ProgressPage(props())
    expect(state.calls).toEqual([['getProgress', undefined]])
    state.calls = []
    await ProgressPage(props({ week: ['a', 'b'] }))
    expect(state.calls).toEqual([['getProgress', undefined]])
  })

  it('renders the progress view', async () => {
    render(await ProgressPage(props()))
    expect(screen.getByRole('heading', { level: 1, name: 'Tiến độ' })).toBeTruthy()
  })
})
