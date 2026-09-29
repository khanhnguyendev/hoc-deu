import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveEventId, digest } from '@/lib/events/ids'
import { EventError } from '@/lib/events/apply'
import { vi as copy } from '@/lib/i18n/vi'

const REQUEST_ID = '0f8d6a52-3b1c-4d7e-9a2f-6c5b4e3d2a10'
const USER_ID = '5b0c61a2-7f5e-4c3b-9a41-2f1d7c8e9a10'
const ITEM_ID = 'user:0123456789abcdef:standup-card'

const fake = vi.hoisted(() => ({
  calls: [] as unknown[][],
  rows: [] as unknown[],
  outcome: 'applied' as unknown,
  denied: null as Error | null,
}))

vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => fake.calls.push(['revalidatePath', path]),
}))
vi.mock('@/lib/auth/dal', () => ({
  requireOnboarded: async () => {
    fake.calls.push(['requireOnboarded'])
    if (fake.denied !== null) throw fake.denied
    return { id: USER_ID }
  },
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => 'session' }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => 'admin' }))
vi.mock('@/lib/plans/reads', () => ({
  readUserItems: async (client: unknown, userId: string) => {
    fake.calls.push(['readUserItems', client, userId])
    return fake.rows
  },
}))
vi.mock('@/lib/events/user-items', () => ({
  hideUserItem: async (client: unknown, userId: string, input: unknown) => {
    fake.calls.push(['hideUserItem', client, userId, input])
    if (fake.outcome instanceof Error) throw fake.outcome
    return fake.outcome
  },
}))

const { hideCustomItem } = await import('./actions')

const row = (status = 'active') => ({
  itemId: ITEM_ID,
  itemType: 'flashcard',
  trackId: 'english',
  topicId: 'standup',
  payload: {},
  status,
  createdOn: '2026-10-01',
})

beforeEach(() => {
  fake.calls = []
  fake.rows = [row()]
  fake.outcome = 'applied'
  fake.denied = null
})

describe('hideCustomItem ("Ẩn", §5.12)', () => {
  it('guards first, then hides the learner’s own item as the learner (requestId + digest)', async () => {
    expect(await hideCustomItem({ requestId: REQUEST_ID, itemId: ITEM_ID })).toEqual({
      ok: true,
      message: copy.customItems.hide.done,
    })
    expect(fake.calls[0]).toEqual(['requireOnboarded'])
    expect(fake.calls).toContainEqual(['readUserItems', 'session', USER_ID])
    expect(fake.calls).toContainEqual([
      'hideUserItem',
      'admin',
      USER_ID,
      {
        eventId: deriveEventId(REQUEST_ID, `user_item.hidden:${digest({ itemId: ITEM_ID })}`),
        itemId: ITEM_ID,
        itemType: 'flashcard',
      },
    ])
    expect(fake.calls).toContainEqual(['revalidatePath', '/t/english'])
    expect(fake.calls).toContainEqual([
      'revalidatePath',
      '/t/english/items/user%3A0123456789abcdef%3Astandup-card',
    ])
  })

  it('an item already hidden is unchanged: said, not an error', async () => {
    fake.outcome = 'unchanged'
    expect(await hideCustomItem({ requestId: REQUEST_ID, itemId: ITEM_ID })).toEqual({
      ok: true,
      message: copy.customItems.hide.already,
    })
  })

  it('reads and writes nothing when the guard redirects', async () => {
    fake.denied = new Error('REDIRECT:/sign-in')
    await expect(hideCustomItem({ requestId: REQUEST_ID, itemId: ITEM_ID })).rejects.toThrow(
      'REDIRECT',
    )
    expect(fake.calls).toEqual([['requireOnboarded']])
  })

  it('refuses a bad input and an item that is not the learner’s, writing nothing', async () => {
    expect(await hideCustomItem({ requestId: 'nope', itemId: ITEM_ID })).toEqual({
      ok: false,
      message: copy.errors.saveFailed,
    })
    expect(await hideCustomItem({ requestId: REQUEST_ID, itemId: 'dsa:lc-0001' })).toEqual({
      ok: false,
      message: copy.errors.saveFailed,
    })
    fake.rows = []
    expect(await hideCustomItem({ requestId: REQUEST_ID, itemId: ITEM_ID })).toEqual({
      ok: false,
      message: copy.customItems.hide.notFound,
    })
    expect(fake.calls.some((call) => call[0] === 'hideUserItem')).toBe(false)
  })

  it('answers an EventError with its message; anything else reaches the error boundary', async () => {
    fake.outcome = new EventError('invalid_transition')
    expect(await hideCustomItem({ requestId: REQUEST_ID, itemId: ITEM_ID })).toEqual({
      ok: false,
      message: new EventError('invalid_transition').userMessage,
    })
    fake.outcome = new Error('boom')
    await expect(hideCustomItem({ requestId: REQUEST_ID, itemId: ITEM_ID })).rejects.toThrow('boom')
  })
})
