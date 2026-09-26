import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TodayViewProps } from '@/features/today'

const state = vi.hoisted(() => ({
  calls: [] as unknown[][],
  page: { requestId: 'r-1' } as unknown,
  slots: { 'block-1': { items: [], sentences: [] } },
  markPlanSeen: async () => {},
  resumeTodayAction: async () => ({ ok: true, message: '' }),
  props: null as TodayViewProps | null,
}))

vi.mock('@/features/today', () => ({
  getToday: async () => {
    state.calls.push(['getToday'])
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

const { default: TodayPage, metadata } = await import('./page')

describe('(app)/today/page (task 5.1b)', () => {
  it('loads the page, builds its slots, and hands TodayView the actions unbound', async () => {
    render(await TodayPage())
    expect(screen.getByRole('heading', { level: 1, name: 'Hôm nay' })).toBeTruthy()
    expect(state.calls).toEqual([['getToday'], ['todaySlots', state.page]])
    expect(state.props?.page).toBe(state.page)
    expect(state.props?.slots).toBe(state.slots)
    expect(state.props?.markPlanSeen).toBe(state.markPlanSeen)
    expect(state.props?.resumeToday).toBe(state.resumeTodayAction)
  })

  it('titles the tab "Hôm nay — Học Đều"', () => {
    expect(metadata.title).toBe('Hôm nay — Học Đều')
  })
})
