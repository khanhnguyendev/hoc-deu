import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { problemItem } from '@/features/items/fixtures'
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

describe('ItemBody (task 5.1c)', () => {
  it('awaits renderItemPage with a null state and an empty context, and renders its result', async () => {
    const item = problemItem()
    const viewer = { codeLanguage: 'python' as const, isAdmin: false }
    const resolveItem = () => null
    const node = await ItemBody({ item, viewer, resolveItem })
    expect(state.calls).toEqual([
      ['renderItemPage', item, { state: null, context: {}, viewer, resolveItem }],
    ])
    render(<>{node}</>)
    expect(screen.getByRole('heading', { level: 1, name: item.title })).toBeTruthy()
  })
})
