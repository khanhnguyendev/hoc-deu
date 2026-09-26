import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TodayViewProps } from '@/features/today'

const state = vi.hoisted(() => ({
  calls: [] as unknown[][],
  page: { requestId: 'r-1' } as unknown,
  slots: { 'block-1': { items: [], sentences: [] } },
  markPlanSeen: async () => {},
  resumeTodayAction: async () => ({ ok: true, message: '' }),
  checkInBlock: async () => ({ ok: true, message: '' }),
  props: null as TodayViewProps | null,
}))

vi.mock('@/features/today', () => ({
  getToday: async (...args: unknown[]) => {
    state.calls.push(['getToday', ...args])
    return state.page
  },
  todaySlots: (page: unknown) => {
    state.calls.push(['todaySlots', page])
    return state.slots
  },
  markPlanSeen: state.markPlanSeen,
  resumeTodayAction: state.resumeTodayAction,
  TodayView: (props: TodayViewProps) => {
    state.props = props
    return <h1>Hôm nay</h1>
  },
}))
vi.mock('@/features/checkin', () => ({ checkInBlock: state.checkInBlock }))

const { default: TodayPage, metadata } = await import('./page')

const props = (searchParams: Record<string, string | string[] | undefined>) =>
  ({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(searchParams),
  }) as Parameters<typeof TodayPage>[0]

beforeEach(() => {
  state.calls = []
  state.props = null
})

describe('(app)/today/page (tasks 5.1b, 5.2b)', () => {
  it('loads the page, builds its slots, and hands TodayView the actions unbound', async () => {
    render(await TodayPage(props({})))
    expect(screen.getByRole('heading', { level: 1, name: 'Hôm nay' })).toBeTruthy()
    expect(state.calls).toEqual([
      ['getToday', undefined],
      ['todaySlots', state.page],
    ])
    expect(state.props?.page).toBe(state.page)
    expect(state.props?.slots).toBe(state.slots)
    expect(state.props?.markPlanSeen).toBe(state.markPlanSeen)
    expect(state.props?.resumeToday).toBe(state.resumeTodayAction)
    // 5.2b: the check-in action, unbound — the client builds its input.
    expect(state.props?.checkIn).toBe(state.checkInBlock)
  })

  it('passes ?block= to getToday when it is a single value (§2.4)', async () => {
    render(await TodayPage(props({ block: '2026-09-28:dsa:new:1' })))
    expect(state.calls[0]).toEqual(['getToday', '2026-09-28:dsa:new:1'])
    state.calls = []
    render(await TodayPage(props({ block: ['a', 'b'] })))
    expect(state.calls[0]).toEqual(['getToday', undefined])
  })

  it('titles the tab "Hôm nay — Học Đều"', () => {
    expect(metadata.title).toBe('Hôm nay — Học Đều')
  })
})
