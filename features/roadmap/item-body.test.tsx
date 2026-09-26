import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FIXTURE_LINKS, outcomeBinding, problemItem, promptItem } from '@/features/items/fixtures'
import { ItemBody } from './item-body'

const state = vi.hoisted(() => ({ calls: [] as unknown[][] }))

vi.mock('@/features/items', () => ({
  renderItemPage: async (item: { title: string }, props: unknown) => {
    state.calls.push(['renderItemPage', item, props])
    return <h1>{item.title}</h1>
  },
}))

beforeEach(() => {
  state.calls = []
})

const viewer = { codeLanguage: 'python' as const, isAdmin: false }
const resolveItem = () => null

describe('ItemBody (tasks 5.1c, 5.2c)', () => {
  it('awaits renderItemPage and renders its result; read-only without a binding', async () => {
    const item = problemItem()
    const node = await ItemBody({ item, viewer, resolveItem, state: null })
    expect(state.calls).toEqual([
      [
        'renderItemPage',
        item,
        {
          state: null,
          viewer,
          resolveItem,
          outcome: undefined,
          mockInterviewProblem: undefined,
        },
      ],
    ])
    render(<>{node}</>)
    expect(screen.getByRole('heading', { level: 1, name: item.title })).toBeTruthy()
  })

  it('task 5.2c: the outcome binding, the learner’s state and the mock-interview pick reach the Page', async () => {
    const item = promptItem()
    const record = vi.fn()
    const outcome = outcomeBinding(record, { itemId: item.id, mode: 'review' })
    const learned = { status: 'ok', level: 0, dueOn: null } as const
    const problem = FIXTURE_LINKS['dsa:lc-0015']!
    await ItemBody({
      item,
      viewer,
      resolveItem,
      state: learned,
      outcome,
      mockInterviewProblem: problem,
    })
    const [, , props] = state.calls[0] as [string, unknown, Record<string, unknown>]
    expect(props).toEqual({
      state: learned,
      viewer,
      resolveItem,
      outcome,
      mockInterviewProblem: problem,
    })
    expect((props.outcome as { record: unknown }).record).toBe(record)
  })
})
