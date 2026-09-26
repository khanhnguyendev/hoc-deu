import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { problemItem } from '@/features/items/fixtures'
import type { ItemPageModel } from '@/features/roadmap'
import ItemPage, { generateMetadata } from './page'

const state = vi.hoisted(() => ({
  model: null as unknown,
  calls: [] as unknown[][],
}))

vi.mock('@/features/roadmap', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/roadmap')>()),
  getItemPage: async (trackId: string, itemParam: string) => {
    state.calls.push(['getItemPage', trackId, itemParam])
    return state.model
  },
  ItemBody: (props: { item: { title: string }; viewer: unknown; resolveItem: unknown }) => {
    state.calls.push(['ItemBody', props.item, props.viewer, props.resolveItem])
    return <h1>{props.item.title}</h1>
  },
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404')
  },
}))

const resolveItem = () => null
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
}

const props = (trackId: string, itemId: string) => ({
  params: Promise.resolve({ trackId, itemId }),
  searchParams: Promise.resolve({}),
})

beforeEach(() => {
  state.model = MODEL
  state.calls = []
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
    expect(state.calls[0]).toEqual(['getItemPage', 'english', 'explaining-code%3Adsa%3Alc-0001'])
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
