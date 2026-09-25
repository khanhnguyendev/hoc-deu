import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { RULES_VERSION } from '@/lib/domain/rules'
import { vi as copy } from '@/lib/i18n/vi'
import type { Database } from '@/lib/supabase/database.types'
import {
  applyLearnerEvent,
  applySystemEvent,
  EventError,
  isRetryable,
  withRetry,
  type EventErrorCode,
  type EventInput,
} from './apply'
import type { DerivedWrite } from './derived'

const EVENT_ID = '0b8e5f5c-6f7a-4c8e-9a4b-2d6f1e3c9a10'
const USER_ID = '7d4c2b1a-3e5f-4a6b-8c9d-0e1f2a3b4c5d'
const ADMIN_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
const PLAN_ID = '9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f'

type RpcResult = { data: unknown; error: { message: string; code?: string } | null }

/** A client whose `rpc` records each call and answers with `result`. */
function fakeClient(result: RpcResult) {
  const calls: { fn: string; args: unknown }[] = []
  const client = {
    rpc: (fn: string, args: unknown) => {
      calls.push({ fn, args })
      return Promise.resolve(result)
    },
  } as unknown as SupabaseClient<Database>
  return { client, calls }
}

const applied = (): RpcResult => ({ data: { outcome: 'applied', versions: {} }, error: null })
const failed = (message: string): RpcResult => ({ data: null, error: { message, code: 'P0001' } })

const ENROLLED = {
  id: EVENT_ID,
  type: 'track.enrolled',
  trackId: 'dsa',
  payload: { roadmapVariant: '10w', budgetMinutes: 60, startDate: '2026-09-25' },
} as const

async function eventError(promise: Promise<unknown>): Promise<EventError> {
  const error: unknown = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  )
  expect(error).toBeInstanceOf(EventError)
  return error as EventError
}

describe('applyLearnerEvent', () => {
  it('calls apply_event with snake_case keys and rules_version', async () => {
    const { client, calls } = fakeClient(applied())
    await expect(applyLearnerEvent(client, ENROLLED)).resolves.toBe('applied')
    expect(calls).toEqual([
      {
        fn: 'apply_event',
        args: {
          p_event: {
            id: EVENT_ID,
            type: 'track.enrolled',
            track_id: 'dsa',
            payload: { roadmapVariant: '10w', budgetMinutes: 60, startDate: '2026-09-25' },
            rules_version: RULES_VERSION,
          },
        },
      },
    ])
  })

  it('maps itemId, planId and blockId to item_id, plan_id and block_id', async () => {
    const { client, calls } = fakeClient(applied())
    await applyLearnerEvent(client, {
      id: EVENT_ID,
      type: 'item.result',
      payload: { result: 'solved' },
      trackId: 'dsa',
      itemId: 'dsa:two-sum',
      planId: PLAN_ID,
      blockId: 'b1',
    })
    expect(calls[0]?.args).toEqual({
      p_event: {
        id: EVENT_ID,
        type: 'item.result',
        track_id: 'dsa',
        item_id: 'dsa:two-sum',
        plan_id: PLAN_ID,
        block_id: 'b1',
        payload: { result: 'solved' },
        rules_version: RULES_VERSION,
      },
    })
  })

  it('sends local_day, p_changes and p_expected with a derived write (decision 10)', async () => {
    const { client, calls } = fakeClient(applied())
    const derived: DerivedWrite = {
      changes: [
        {
          table: 'item_state',
          row: { item_id: 'dsa:two-sum', track_id: 'dsa', level: 1, status: 'ok' },
        },
        {
          table: 'daily_activity',
          row: { local_day: '2026-09-28', minutes_by_track: {}, items_done: 1, completed: false },
        },
      ],
      expected: { 'item_state:dsa:two-sum': 2, 'daily_activity:2026-09-28': 0 },
    }
    await expect(
      applyLearnerEvent(
        client,
        {
          id: EVENT_ID,
          type: 'item.result',
          payload: { result: 'solved' },
          trackId: 'dsa',
          itemId: 'dsa:two-sum',
          localDay: '2026-09-28',
        },
        derived,
      ),
    ).resolves.toBe('applied')
    expect(calls).toEqual([
      {
        fn: 'apply_event',
        args: {
          p_event: {
            id: EVENT_ID,
            type: 'item.result',
            track_id: 'dsa',
            item_id: 'dsa:two-sum',
            local_day: '2026-09-28',
            payload: { result: 'solved' },
            rules_version: RULES_VERSION,
          },
          p_changes: derived.changes,
          p_expected: derived.expected,
        },
      },
    ])
  })

  it('sends an empty derived write as empty p_changes and p_expected', async () => {
    const { client, calls } = fakeClient(applied())
    await applyLearnerEvent(client, ENROLLED, { changes: [], expected: {} })
    expect(calls[0]?.args).toMatchObject({ p_changes: [], p_expected: {} })
  })

  it('passes duplicate through', async () => {
    const { client } = fakeClient({ data: { outcome: 'duplicate', versions: {} }, error: null })
    await expect(applyLearnerEvent(client, ENROLLED)).resolves.toBe('duplicate')
  })

  it('turns quota_exceeded into an EventError with the §4.5 message', async () => {
    const { client } = fakeClient(failed('quota_exceeded'))
    const error = await eventError(applyLearnerEvent(client, ENROLLED))
    expect(error.code).toBe('quota_exceeded')
    expect(error.userMessage).toBe(
      'Bạn đã ghi nhận quá nhiều hoạt động hôm nay. Hãy thử lại vào ngày mai.',
    )
    expect(error.userMessage).toBe(copy.errors.quotaExceeded)
  })

  it.each<[EventErrorCode, string]>([
    ['quota_exceeded', copy.errors.quotaExceeded],
    ['forbidden', copy.errors.notAllowed],
    ['inactive', copy.errors.notAllowed],
    ['invalid_event', copy.errors.saveFailed],
    ['not_implemented', copy.errors.saveFailed],
    ['invalid_transition', copy.errors.invalidTransition],
    ['track_not_enrolled', copy.errors.invalidTransition],
    ['invalid_timezone', copy.errors.invalidTimezone],
    ['ai_personalization_off', copy.errors.saveFailed],
    ['id_conflict', copy.errors.saveFailed],
    ['schedule_backdated', copy.errors.saveFailed],
    ['schedule_in_force', copy.errors.saveFailed],
    ['too_many_tracks', copy.errors.tooManyTracks],
    ['too_many_pending_schedules', copy.errors.tooManyPendingSchedules],
    ['version_conflict', copy.errors.saveFailed],
    ['day_changed', copy.errors.saveFailed],
  ])('maps the RPC error %s to its code and message', async (code, userMessage) => {
    const { client } = fakeClient(failed(code))
    const error = await eventError(applyLearnerEvent(client, ENROLLED))
    expect(error.code).toBe(code)
    expect(error.userMessage).toBe(userMessage)
  })

  it('maps the state-table caps (ruling R14) to their own Vietnamese messages', async () => {
    const tracks = await eventError(
      applyLearnerEvent(fakeClient(failed('too_many_tracks')).client, ENROLLED),
    )
    expect(tracks.userMessage).toBe('Bạn đã đạt số lộ trình tối đa.')
    const schedules = await eventError(
      applyLearnerEvent(fakeClient(failed('too_many_pending_schedules')).client, {
        id: EVENT_ID,
        type: 'schedule.changed',
        payload: {
          timezone: 'Asia/Ho_Chi_Minh',
          dayStartsAt: '05:00',
          effectiveAt: '2026-09-25T21:00:00.000Z',
        },
      }),
    )
    expect(schedules.userMessage).toBe(
      'Đã có một thay đổi lịch đang chờ áp dụng. Bạn tải lại trang nhé.',
    )
  })

  it.each([
    'permission denied for function apply_event',
    'not_authenticated',
    'unknown',
    'TypeError: fetch failed',
  ])('maps the unknown message %j to unknown and saveFailed', async (message) => {
    const { client } = fakeClient(failed(message))
    const error = await eventError(applyLearnerEvent(client, ENROLLED))
    expect(error.code).toBe('unknown')
    expect(error.userMessage).toBe(copy.errors.saveFailed)
  })

  it('treats a response without a known outcome as unknown', async () => {
    const { client } = fakeClient({ data: { outcome: 'maybe' }, error: null })
    expect((await eventError(applyLearnerEvent(client, ENROLLED))).code).toBe('unknown')
  })

  it('rejects an invalid payload before calling the database', async () => {
    const { client, calls } = fakeClient(applied())
    const error = await eventError(
      applyLearnerEvent(client, {
        ...ENROLLED,
        payload: { roadmapVariant: '10w', budgetMinutes: 7, startDate: '2026-09-25' },
      }),
    )
    expect(error.code).toBe('invalid_event')
    expect(error.userMessage).toBe(copy.errors.saveFailed)
    expect(calls).toEqual([])
  })

  it('rejects a type that is not a learner type before calling the database', async () => {
    const { client, calls } = fakeClient(applied())
    const error = await eventError(
      applyLearnerEvent(client, {
        id: EVENT_ID,
        type: 'onboarding.completed',
        trackId: 'dsa',
        payload: {},
      } as unknown as EventInput<'track.paused'>),
    )
    expect(error.code).toBe('invalid_event')
    expect(calls).toEqual([])
  })
})

describe('applySystemEvent', () => {
  it('calls apply_system_event with p_user_id, snake_case keys and rules_version', async () => {
    const { client, calls } = fakeClient(applied())
    await expect(
      applySystemEvent(client, USER_ID, {
        id: EVENT_ID,
        type: 'onboarding.completed',
        payload: {},
      }),
    ).resolves.toBe('applied')
    expect(calls).toEqual([
      {
        fn: 'apply_system_event',
        args: {
          p_user_id: USER_ID,
          p_event: {
            id: EVENT_ID,
            type: 'onboarding.completed',
            payload: {},
            rules_version: RULES_VERSION,
          },
        },
      },
    ])
  })

  it('sends source and actor_id when given', async () => {
    const { client, calls } = fakeClient({ data: { outcome: 'duplicate' }, error: null })
    await expect(
      applySystemEvent(client, USER_ID, {
        id: EVENT_ID,
        type: 'admin.bootstrapped',
        payload: { targetUserId: USER_ID, from: 'pending', to: 'active' },
        source: 'admin',
        actorId: ADMIN_ID,
      }),
    ).resolves.toBe('duplicate')
    expect(calls[0]?.args).toEqual({
      p_user_id: USER_ID,
      p_event: {
        id: EVENT_ID,
        type: 'admin.bootstrapped',
        payload: { targetUserId: USER_ID, from: 'pending', to: 'active' },
        rules_version: RULES_VERSION,
        source: 'admin',
        actor_id: ADMIN_ID,
      },
    })
  })

  it('maps RPC errors like applyLearnerEvent', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'inactive', code: '42501' } })
    const error = await eventError(
      applySystemEvent(client, USER_ID, {
        id: EVENT_ID,
        type: 'onboarding.completed',
        payload: {},
      }),
    )
    expect(error.code).toBe('inactive')
    expect(error.userMessage).toBe(copy.errors.notAllowed)
  })

  it('rejects an invalid payload before calling the database', async () => {
    const { client, calls } = fakeClient(applied())
    const error = await eventError(
      applySystemEvent(client, USER_ID, {
        id: EVENT_ID,
        type: 'onboarding.completed',
        payload: { extra: true },
      } as unknown as EventInput<'onboarding.completed'>),
    )
    expect(error.code).toBe('invalid_event')
    expect(calls).toEqual([])
  })

  it('rejects a type that is not a system type before calling the database', async () => {
    const { client, calls } = fakeClient(applied())
    const error = await eventError(
      applySystemEvent(client, USER_ID, {
        id: EVENT_ID,
        type: 'track.paused',
        payload: {},
      } as unknown as EventInput<'onboarding.completed'>),
    )
    expect(error.code).toBe('invalid_event')
    expect(calls).toEqual([])
  })
})

describe('isRetryable', () => {
  it.each<EventErrorCode>(['version_conflict', 'day_changed'])('is true for %s', (code) => {
    expect(isRetryable(new EventError(code))).toBe(true)
  })

  it.each<EventErrorCode>(['invalid_event', 'quota_exceeded', 'id_conflict', 'unknown'])(
    'is false for %s',
    (code) => {
      expect(isRetryable(new EventError(code))).toBe(false)
    },
  )

  it('is false for anything that is not an EventError', () => {
    expect(isRetryable(new Error('version_conflict'))).toBe(false)
    expect(isRetryable({ code: 'version_conflict' })).toBe(false)
    expect(isRetryable('version_conflict')).toBe(false)
  })
})

describe('withRetry (§4.4: reload, recompute, retry — at most 3 times)', () => {
  /** An attempt that fails with `failures` in order, then resolves with `'done'`. */
  function attemptFailing(...failures: unknown[]) {
    let calls = 0
    const attempt = () => {
      const failure = failures[calls]
      calls += 1
      return failure === undefined ? Promise.resolve('done') : Promise.reject(failure)
    }
    return { attempt, calls: () => calls }
  }

  it('returns the first success without retrying', async () => {
    const { attempt, calls } = attemptFailing()
    await expect(withRetry(attempt)).resolves.toBe('done')
    expect(calls()).toBe(1)
  })

  it('re-runs the attempt after a version_conflict or a day_changed', async () => {
    const { attempt, calls } = attemptFailing(
      new EventError('version_conflict'),
      new EventError('day_changed'),
    )
    await expect(withRetry(attempt)).resolves.toBe('done')
    expect(calls()).toBe(3)
  })

  it('gives up after 3 attempts and rethrows the last error', async () => {
    const last = new EventError('version_conflict')
    const { attempt, calls } = attemptFailing(
      new EventError('version_conflict'),
      new EventError('day_changed'),
      last,
      undefined,
    )
    await expect(withRetry(attempt)).rejects.toBe(last)
    expect(calls()).toBe(3)
  })

  it('takes another number of attempts', async () => {
    const { attempt, calls } = attemptFailing(
      new EventError('version_conflict'),
      new EventError('version_conflict'),
    )
    await expect(withRetry(attempt, 2)).rejects.toBeInstanceOf(EventError)
    expect(calls()).toBe(2)
  })

  it.each([new EventError('invalid_event'), new EventError('quota_exceeded'), new Error('boom')])(
    'rethrows %s at once',
    async (error) => {
      const { attempt, calls } = attemptFailing(error)
      await expect(withRetry(attempt)).rejects.toBe(error)
      expect(calls()).toBe(1)
    },
  )
})
