import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { problemItem } from '@/features/items/fixtures'
import type { ItemPageModel } from '@/features/roadmap'
import ItemPage, { generateMetadata } from './page'

const state = vi.hoisted(() => ({
  model: null as unknown,
  calls: [] as unknown[][],
  bodies: [] as Record<string, unknown>[],
  recordOutcome: async () => ({ ok: true, message: '', autoCheckedIn: [] }),
}))

vi.mock('@/features/checkin', () => ({ recordOutcome: state.recordOutcome }))

vi.mock('@/features/roadmap', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/roadmap')>()),
  getItemPage: async (trackId: string, itemParam: string, block?: string, mode?: string) => {
    state.calls.push(['getItemPage', trackId, itemParam, block, mode])
    return state.model
  },
  ItemBody: (props: {
    item: { title: string }
    viewer: unknown
    resolveItem: unknown
    [key: string]: unknown
  }) => {
    state.calls.push(['ItemBody', props.item, props.viewer, props.resolveItem])
    state.bodies.push(props)
    return <h1>{props.item.title}</h1>
  },
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404')
  },
}))

const resolveItem = () => null
const OUTCOME = {
  mode: 'new' as const,
  plan: { blockId: 'b-new', label: 'Trong kế hoạch hôm nay' },
  state: null,
  due: false,
  requestId: '5f0c8a4e-2b1d-4c3a-9e8f-7a6b5c4d3e2f',
  itemId: 'dsa:lc-0001',
  blockId: 'b-new',
}
const MODEL: ItemPageModel = {
  item: problemItem(),
  track: {
    id: 'dsa',
    title: 'Cấu trúc dữ liệu & Giải thuật',
    titleEn: 'Data Structures & Algorithms',
    accent: 'track-1',
    status: 'active',
  },
  viewer: { codeLanguage: 'python', isAdmin: false },
  backHref: '/t/dsa',
  resolveItem,
  state: null,
  outcome: OUTCOME,
}

const props = (
  trackId: string,
  itemId: string,
  query: Record<string, string | string[] | undefined> = {},
) => ({
  params: Promise.resolve({ trackId, itemId }),
  searchParams: Promise.resolve(query),
})

beforeEach(() => {
  state.model = MODEL
  state.calls = []
  state.bodies = []
})

describe('/t/[trackId]/items/[itemId]', () => {
  it('is titled "{title} — Học Đều"', async () => {
    await expect(generateMetadata(props('dsa', 'lc-0001'))).resolves.toEqual({
      title: 'Two Sum — Học Đều',
    })
  })

  it('answers 404 when the loader shows no item', async () => {
    state.model = null
    await expect(ItemPage(props('dsa', 'lc-99999'))).rejects.toThrow('404')
    await expect(generateMetadata(props('dsa', 'lc-99999'))).rejects.toThrow('404')
  })

  it('passes the raw route parameter to the loader (it decodes derived IDs)', async () => {
    await ItemPage(props('english', 'explaining-code%3Adsa%3Alc-0001'))
    expect(state.calls[0]).toEqual([
      'getItemPage',
      'english',
      'explaining-code%3Adsa%3Alc-0001',
      undefined,
      undefined,
    ])
  })

  it('task 5.2c: passes ?block= and ?mode= (the first of a repeated one) to the loader', async () => {
    await ItemPage(props('dsa', 'lc-0001', { block: ['b-new', 'b-x'], mode: 'recall' }))
    await generateMetadata(props('dsa', 'lc-0001', { block: ['b-new', 'b-x'], mode: 'recall' }))
    const loads = state.calls.filter((call) => call[0] === 'getItemPage')
    // The same primitive arguments both times: the loader's cache() shares one read.
    expect(loads).toEqual([
      ['getItemPage', 'dsa', 'lc-0001', 'b-new', 'recall'],
      ['getItemPage', 'dsa', 'lc-0001', 'b-new', 'recall'],
    ])
  })

  it('task 5.2c: binds the page’s outcome to recordOutcome, unbound, and passes the state', async () => {
    render(await ItemPage(props('dsa', 'lc-0001')))
    const body = state.bodies[0]!
    expect(body.outcome).toEqual({ ...OUTCOME, record: state.recordOutcome })
    expect((body.outcome as { record: unknown }).record).toBe(state.recordOutcome)
    expect(body.state).toBeNull()
    expect(body.mockInterviewProblem).toBeUndefined()
  })

  it('task 5.2c: a read-only page (outcome null) gets no binding', async () => {
    state.model = { ...MODEL, outcome: null }
    render(await ItemPage(props('dsa', 'lc-0001')))
    expect(state.bodies[0]!.outcome).toBeUndefined()
  })

  it('renders ItemBody inside ItemView (task 5.1c) with the back link', async () => {
    render(await ItemPage(props('dsa', 'lc-0001')))
    expect(state.calls).toContainEqual(['ItemBody', MODEL.item, MODEL.viewer, resolveItem])
    expect(screen.getByRole('heading', { level: 1, name: 'Two Sum' })).toBeTruthy()
    expect(
      screen
        .getByRole('link', { name: 'Về lộ trình Cấu trúc dữ liệu & Giải thuật' })
        .getAttribute('href'),
    ).toBe('/t/dsa')
  })
})
