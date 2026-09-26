import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReviewPage as ReviewPageData } from '@/features/review'
import ReviewPage, { metadata } from './page'

const state = vi.hoisted(() => ({
  page: null as unknown as ReviewPageData,
  calls: [] as unknown[][],
}))

vi.mock('@/features/review', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/review')>()),
  getReview: async (track: string | undefined) => {
    state.calls.push(['getReview', track])
    return state.page
  },
}))

vi.mock('@/features/checkin', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/checkin')>()),
  recordOutcome: async () => ({ ok: true, message: '', autoCheckedIn: [] }),
}))

const BASE: ReviewPageData = {
  entries: [],
  cards: [],
  tracks: [],
  track: null,
  requestId: '5f0c8a4e-2b1d-4c3a-9e8f-7a6b5c4d3e2f',
}

const props = (search: Record<string, string | string[]> = {}) => ({
  params: Promise.resolve({}),
  searchParams: Promise.resolve(search),
})

beforeEach(() => {
  state.page = BASE
  state.calls = []
})

describe('/review', () => {
  it('is titled "Ôn tập — Học Đều"', () => {
    expect(metadata.title).toBe('Ôn tập — Học Đều')
  })

  it('reads ?track= as a single value and passes it to getReview', async () => {
    await ReviewPage(props({ track: 'english' }))
    expect(state.calls).toEqual([['getReview', 'english']])
  })

  it('passes undefined for a missing or multi-valued ?track=', async () => {
    await ReviewPage(props())
    expect(state.calls).toEqual([['getReview', undefined]])
    state.calls = []
    await ReviewPage(props({ track: ['a', 'b'] }))
    expect(state.calls).toEqual([['getReview', undefined]])
  })

  it('renders the review view', async () => {
    render(await ReviewPage(props()))
    expect(screen.getByRole('heading', { level: 1, name: 'Ôn tập' })).toBeTruthy()
  })
})
