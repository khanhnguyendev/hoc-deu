import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lessonItem, problemItem, promptItem } from '@/features/items/fixtures'
import type { TrackPageData } from '@/features/roadmap'
import TrackPage, { generateMetadata } from './page'

const state = vi.hoisted(() => ({
  data: null as unknown,
  calls: [] as unknown[][],
}))

vi.mock('@/features/roadmap', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/roadmap')>()),
  getTrackPage: async (trackId: string, variant: string | undefined) => {
    state.calls.push(['getTrackPage', trackId, variant])
    return state.data
  },
}))
vi.mock('@/features/items', () => ({
  renderItemRow: (
    item: { id: string; title: string },
    props: { state: unknown; mode?: string },
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
        core: [problemItem()],
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
    expect(rows).toContainEqual(['renderItemRow', 'dsa:lc-0001', { state: null, mode: 'recall' }])
    expect(rows).toContainEqual(['renderItemRow', 'dsa:lc-0001', { state: null, mode: undefined }])
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
