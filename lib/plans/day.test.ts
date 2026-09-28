import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CATALOG } from '@/lib/domain/plan/__tests__/fixtures'
import { userItemOf } from '@/lib/content/user-items'
import type { RowOf } from '@/lib/testing/fake-supabase'
import { resetEnv } from './__tests__/env'
import { NOW, OTHER_USER_ID, scheduleRow, TODAY, trackRow, USER_ID } from './__tests__/fixtures'

vi.mock('./catalog', async () => (await import('./__tests__/env')).catalogMock)

const { loadDay } = await import('./day')

const CARD_ID = 'user:0123456789abcdef:ah-card'

function userItem(change: Partial<RowOf<'user_items'>> = {}): RowOf<'user_items'> {
  return {
    user_id: USER_ID,
    item_id: CARD_ID,
    item_type: 'flashcard',
    track_id: 'dsa',
    topic_id: 'arrays',
    payload: { front: 'two pointers', back: 'hai con trỏ', tags: [] },
    status: 'active',
    created_by_run: 'run_2026-09-28',
    created_on: TODAY,
    created_at: '2026-09-28T00:00:00.000Z',
    ...change,
  }
}

beforeEach(() => {
  resetEnv()
})

describe('loadDay: the per-user catalog overlay (task 6.6a, decision 17)', () => {
  it("builds the day's catalog with the learner's custom items", async () => {
    const fake = resetEnv({
      schedule_versions: [scheduleRow()],
      user_tracks: [trackRow('dsa')],
      user_items: [
        userItem(),
        userItem({ item_id: 'user:0123456789abcdef:gone', status: 'hidden' }),
        userItem({ user_id: OTHER_USER_ID, item_id: 'user:fedcba9876543210:theirs' }),
      ],
    })
    const day = await loadDay(fake.client('session'), USER_ID, NOW)
    expect(day.today).toBe(TODAY)
    expect(day.catalog.items[CARD_ID]).toMatchObject({
      status: 'active',
      itemType: 'flashcard',
      trackId: 'dsa',
      topicId: 'arrays',
    })
    expect(day.catalog.items['user:0123456789abcdef:gone']?.status).toBe('retired')
    expect(day.catalog.items['user:fedcba9876543210:theirs']).toBeUndefined()
    expect(userItemOf(day.catalog, CARD_ID)?.title).toBe('two pointers')
    expect(day.userItems.map((row) => row.itemId)).toEqual([CARD_ID, 'user:0123456789abcdef:gone'])
    // The repository's items are the engine catalog's own.
    expect(day.catalog.items['dsa:p1']).toBe(CATALOG.items['dsa:p1'])
  })

  it('is the engine catalog itself for a learner without custom items', async () => {
    const fake = resetEnv({ schedule_versions: [scheduleRow()], user_tracks: [trackRow('dsa')] })
    const day = await loadDay(fake.client('session'), USER_ID, NOW)
    expect(day.catalog).toBe(CATALOG)
    expect(day.userItems).toEqual([])
  })
})
