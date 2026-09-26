import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lessonItem, problemItem, promptItem } from '@/features/items/fixtures'
import type { TrackPageData } from '@/features/roadmap'
import TrackPage, { generateMetadata } from './page'

const state = vi.hoisted(() => ({
  data: null as unknown,
  calls: [] as unknown[][],
  resetTrack: async () => ({ ok: true, message: '' }),
}))

vi.mock('@/features/roadmap', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/roadmap')>()),
  getTrackPage: async (trackId: string, variant: string | undefined) => {
    state.calls.push(['getTrackPage', trackId, variant])
    return state.data
  },
}))
vi.mock('@/features/settings', () => ({ resetTrack: state.resetTrack }))
vi.mock('@/components/ui/toaster', () => ({ toast: () => {} }))
vi.mock('@/features/items', () => ({
  renderItemRow: (
    item: { id: string; title: string },
    props: { state: unknown; mode?: string; showStatus?: boolean },
  ) => {
    state.calls.push(['renderItemRow', item.id, props])
    return (
      <a key={item.id} href={`/row/${item.id}`}>
        {item.title}
      </a>
    )
  },
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404')
  },
}))

const TWO = problemItem({ id: 'dsa:lc-0002', localId: 'lc-0002', title: 'Add Two Numbers' })

const DATA: TrackPageData = {
  track: {
    id: 'dsa',
    title: 'Cấu trúc dữ liệu & Giải thuật',
    titleEn: 'Data Structures & Algorithms',
    accent: 'track-1',
    status: 'active',
  },
  enrollment: { status: 'active', roadmapVariant: '8w', budgetMinutes: 60 },
  template: [{ label: 'Thứ 7', blocks: ['Ôn tập'] }],
  throttle: [],
  variants: [
    { id: '8w', label: '8 tuần', href: '/t/dsa?variant=8w', current: true },
    { id: '10w', label: '10 tuần', href: '/t/dsa?variant=10w', current: false },
  ],
  view: {
    variant: '8w',
    weeks: [
      {
        week: 1,
        topics: [{ id: 'arrays-hashing', title: 'Arrays & Hashing' }],
        lessons: [lessonItem()],
        core: [problemItem(), TWO],
        recap: [{ item: problemItem(), mode: 'recall' }],
        bonus: [],
        decks: [],
        exercises: [],
        prompts: [],
      },
    ],
    anytime: { prompts: [promptItem()], derivedDecks: [] },
  },
  isAdmin: false,
  states: { 'dsa:lc-0001': { status: 'weak', level: 1, dueOn: '2026-10-05' } },
  progress: { week: 2, weeks: 8, introduced: 20, total: 64 },
  weakItems: [problemItem()],
  requestId: 'c0ffee00-1234-4abc-8def-0123456789ab',
}

const props = (trackId: string, search: Record<string, string | string[]> = {}) => ({
  params: Promise.resolve({ trackId }),
  searchParams: Promise.resolve(search),
})

beforeEach(() => {
  state.data = DATA
  state.calls = []
})

describe('/t/[trackId]', () => {
  it('is titled after the track', async () => {
    await expect(generateMetadata(props('dsa'))).resolves.toEqual({
      title: 'Cấu trúc dữ liệu & Giải thuật — Học Đều',
    })
  })

  it('answers 404 for a track the loader does not show (unknown, draft, retired)', async () => {
    state.data = null
    await expect(TrackPage(props('nope'))).rejects.toThrow('404')
    await expect(generateMetadata(props('nope'))).rejects.toThrow('404')
  })

  it('passes a string ?variant to the loader and ignores a repeated one', async () => {
    await TrackPage(props('dsa', { variant: '10w' }))
    await TrackPage(props('dsa', { variant: ['8w', '10w'] }))
    await TrackPage(props('dsa'))
    expect(state.calls.filter((call) => call[0] === 'getTrackPage')).toEqual([
      ['getTrackPage', 'dsa', '10w'],
      ['getTrackPage', 'dsa', undefined],
      ['getTrackPage', 'dsa', undefined],
    ])
  })

  it('renders the overview and one section per week, rows through renderItemRow (fix 5)', async () => {
    render(await TrackPage(props('dsa')))
    expect(screen.getByRole('heading', { level: 1, name: DATA.track.title })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Phiên bản lộ trình' })).toBeTruthy()
    const week1 = screen.getByRole('region', { name: 'Tuần 1' })
    const core = within(week1).getByRole('list', { name: 'Bài chính' })
    expect(within(core).getByRole('link', { name: 'Two Sum' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Không theo tuần' })).toBeTruthy()
    const rows = state.calls.filter((call) => call[0] === 'renderItemRow')
    const weak = { status: 'weak', level: 1, dueOn: '2026-10-05' }
    // Task 5.4: every row with the learner's state, and the status pill for an enrolled learner.
    expect(rows).toContainEqual([
      'renderItemRow',
      'dsa:lc-0001',
      { state: weak, mode: 'recall', showStatus: true },
    ])
    expect(rows).toContainEqual([
      'renderItemRow',
      'dsa:lc-0001',
      { state: weak, mode: undefined, showStatus: true },
    ])
    expect(rows).toContainEqual([
      'renderItemRow',
      'dsa:lc-0002',
      { state: null, mode: undefined, showStatus: true },
    ])
  })

  it('task 5.4: an enrolled learner’s progress, Weak items and "Bắt đầu lại"', async () => {
    render(await TrackPage(props('dsa')))
    const progress = screen.getByRole('region', { name: 'Tiến độ của bạn' })
    expect(within(progress).getByText('Tuần 2/8')).toBeTruthy()
    expect(within(progress).getByText('20/64 bài chính đã học')).toBeTruthy()
    expect(within(progress).getByRole('button', { name: 'Bắt đầu lại' })).toBeTruthy()
    const weak = screen.getByRole('region', { name: 'Bài yếu' })
    expect(within(weak).getByRole('link', { name: 'Two Sum' })).toBeTruthy()
  })

  it('task 5.4: no learner part and no status pills without an enrollment', async () => {
    state.data = { ...DATA, enrollment: null, progress: null, weakItems: [] }
    render(await TrackPage(props('dsa')))
    expect(screen.queryByRole('region', { name: 'Tiến độ của bạn' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Bài yếu' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Bắt đầu lại' })).toBeNull()
    const rows = state.calls.filter((call) => call[0] === 'renderItemRow')
    expect(rows.every((call) => (call[2] as { showStatus: boolean }).showStatus === false)).toBe(
      true,
    )
  })

  it('[RF-4] shows the empty state with a link to /tracks when the roadmap file is missing', async () => {
    state.data = { ...DATA, view: null }
    render(await TrackPage(props('dsa')))
    expect(
      screen.getByRole('heading', { level: 2, name: 'Lộ trình này chưa có nội dung.' }),
    ).toBeTruthy()
    expect(screen.getByText('Nội dung đang được bổ sung.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Xem các lộ trình' }).getAttribute('href')).toBe(
      '/tracks',
    )
    // The overview still shows: the variants and the weekly template.
    expect(screen.getByRole('region', { name: 'Mẫu tuần' })).toBeTruthy()
  })
})
