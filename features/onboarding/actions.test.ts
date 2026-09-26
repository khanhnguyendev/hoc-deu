import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveEventId } from '@/lib/events/ids'
import { scheduleKey, settingsKey, trackEnrolledKey, trackRemovedKey } from './event-keys'

const REQUEST_ID = '0f8d6a52-3b1c-4d7e-9a2f-6c5b4e3d2a10'
const USER_ID = '5b0c61a2-7f5e-4c3b-9a41-2f1d7c8e9a10'
/** 10:00 in Asia/Ho_Chi_Minh: local day 2026-09-24 with a 04:00 day start. */
const NOW = '2026-09-24T03:00:00.000Z'
/** The first schedule takes effect a minute before the server's `now` (the DB clock may lag). */
const SCHEDULE_FROM = '2026-09-24T02:59:00.000Z'

const fake = vi.hoisted(() => ({
  user: { id: '', onboardedAt: null as string | null },
  /** Throw this from the apply call with this event type (a partial failure). */
  failOn: null as { type: string; error: Error } | null,
  calls: [] as unknown[][],
  /** Every `user_tracks` row the user has (any status) — the fixture both queries read from. */
  enrollments: [] as { trackId: string; status: 'active' | 'paused' | 'removed' }[],
}))

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    fake.calls.push(['redirect', to])
    throw new Error(`REDIRECT:${to}`)
  },
}))
vi.mock('@/lib/auth/dal', () => ({
  requireActive: async () => {
    fake.calls.push(['requireActive'])
    return fake.user
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    client: 'user',
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (col1: string, val1: string) => ({
          // activeEnrollmentIds: .eq('user_id', …).eq('status', 'active')
          eq: (col2: string, val2: string) => {
            fake.calls.push(['from', table, columns, [col1, val1], [col2, val2]])
            return Promise.resolve({
              data: fake.enrollments
                .filter((row) => row.status === 'active')
                .map((row) => ({ track_id: row.trackId })),
              error: null,
            })
          },
          // currentStatusesOf: .eq('user_id', …).in('track_id', […])
          in: (col2: string, vals: string[]) => {
            fake.calls.push(['from', table, columns, [col1, val1], ['in', col2, vals]])
            return Promise.resolve({
              data: fake.enrollments
                .filter((row) => vals.includes(row.trackId))
                .map((row) => ({ track_id: row.trackId, status: row.status })),
              error: null,
            })
          },
        }),
      }),
    }),
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ client: 'admin' }) }))
vi.mock('@/lib/events/apply', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/events/apply')>()
  const fail = (type: string) => {
    if (fake.failOn?.type === type) throw fake.failOn.error
  }
  return {
    ...actual,
    applyLearnerEvent: async (client: { client: string }, event: { type: string }) => {
      fake.calls.push(['applyLearnerEvent', client.client, event])
      fail(event.type)
      return 'applied'
    },
    applySystemEvent: async (
      client: { client: string },
      userId: string,
      event: { type: string },
    ) => {
      fake.calls.push(['applySystemEvent', client.client, userId, event])
      fail(event.type)
      return 'applied'
    },
  }
})

const { EventError } = await import('@/lib/events/apply')
const { completeOnboarding } = await import('./actions')

type Input = {
  requestId: string
  tracks: { trackId: string; budgetMinutes: number; roadmapVariant: string }[]
  startDate: string
  timezone: string
  dayStartsAt: string
  codeLanguage?: string
}

const input = (patch: Partial<Input> = {}): Input => ({
  requestId: REQUEST_ID,
  tracks: [
    { trackId: 'dsa', budgetMinutes: 75, roadmapVariant: '10w' },
    { trackId: 'english', budgetMinutes: 25, roadmapVariant: '10w' },
  ],
  startDate: '2026-09-24',
  timezone: 'Asia/Ho_Chi_Minh',
  dayStartsAt: '04:00',
  codeLanguage: 'python',
  ...patch,
})

const form = (payload: unknown) => {
  const data = new FormData()
  data.set('payload', typeof payload === 'string' ? payload : JSON.stringify(payload))
  return data
}

const submit = (payload: unknown) => completeOnboarding({ status: 'idle' }, form(payload))
const id = (key: string) => deriveEventId(REQUEST_ID, key)
const events = () =>
  fake.calls.filter(([name]) => name === 'applyLearnerEvent' || name === 'applySystemEvent')
const eventTypes = () => events().map((call) => (call.at(-1) as { type: string }).type)
const learnerEvent = (type: string) =>
  events()
    .find((call) => (call.at(-1) as { type: string }).type === type)
    ?.at(-1) as { id: string; payload: Record<string, unknown> } | undefined
const learnerEvents = (type: string) =>
  events()
    .filter((call) => (call.at(-1) as { type: string }).type === type)
    .map(
      (call) => call.at(-1) as { id: string; trackId?: string; payload: Record<string, unknown> },
    )

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(NOW) })
  fake.user = { id: USER_ID, onboardedAt: null }
  fake.failOn = null
  fake.calls = []
  fake.enrollments = []
})
afterEach(() => {
  vi.useRealTimers()
})

describe('completeOnboarding — the events, in order', () => {
  it('records the schedule, the code language, each track and the completion, then goes to /today', async () => {
    await expect(submit(input())).rejects.toThrow('REDIRECT:/today')
    expect(fake.calls).toEqual([
      ['requireActive'],
      [
        'applyLearnerEvent',
        'user',
        {
          id: id(scheduleKey({ timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '04:00' })),
          type: 'schedule.changed',
          payload: {
            timezone: 'Asia/Ho_Chi_Minh',
            dayStartsAt: '04:00',
            effectiveAt: SCHEDULE_FROM,
          },
        },
      ],
      [
        'applyLearnerEvent',
        'user',
        {
          id: id(settingsKey('python')),
          type: 'settings.changed',
          payload: { codeLanguage: 'python' },
        },
      ],
      // currentStatusesOf, read before the enroll loop (M2 minor, digest keys).
      [
        'from',
        'user_tracks',
        'track_id, status',
        ['user_id', USER_ID],
        ['in', 'track_id', ['dsa', 'english']],
      ],
      [
        'applyLearnerEvent',
        'user',
        {
          id: id(
            trackEnrolledKey('dsa', {
              roadmapVariant: '10w',
              budgetMinutes: 75,
              startDate: '2026-09-24',
              currentStatus: null,
            }),
          ),
          type: 'track.enrolled',
          trackId: 'dsa',
          payload: { roadmapVariant: '10w', budgetMinutes: 75, startDate: '2026-09-24' },
        },
      ],
      [
        'applyLearnerEvent',
        'user',
        {
          id: id(
            trackEnrolledKey('english', {
              roadmapVariant: '10w',
              budgetMinutes: 25,
              startDate: '2026-09-24',
              currentStatus: null,
            }),
          ),
          type: 'track.enrolled',
          trackId: 'english',
          payload: { roadmapVariant: '10w', budgetMinutes: 25, startDate: '2026-09-24' },
        },
      ],
      // activeEnrollmentIds, the orphan cleanup's own read (M2 minor).
      ['from', 'user_tracks', 'track_id', ['user_id', USER_ID], ['status', 'active']],
      [
        'applySystemEvent',
        'admin',
        USER_ID,
        { id: id('onboarding.completed'), type: 'onboarding.completed', payload: {} },
      ],
      ['redirect', '/today'],
    ])
  })

  it('sends no settings.changed without a code language (English only)', async () => {
    const englishOnly = input({ tracks: [input().tracks[1]!], codeLanguage: undefined })
    await expect(submit(englishOnly)).rejects.toThrow('REDIRECT:/today')
    expect(eventTypes()).toEqual(['schedule.changed', 'track.enrolled', 'onboarding.completed'])
  })

  it('stores Asia/Saigon as Asia/Ho_Chi_Minh (decision 6)', async () => {
    await expect(submit(input({ timezone: 'Asia/Saigon' }))).rejects.toThrow('REDIRECT:/today')
    expect(learnerEvent('schedule.changed')?.payload.timezone).toBe('Asia/Ho_Chi_Minh')
  })

  it('re-sends the same event ids on a retry that changes nothing (RF-2)', async () => {
    fake.failOn = { type: 'track.enrolled', error: new EventError('unknown') }
    await submit(input())
    const firstIds = events().map((call) => (call.at(-1) as { id: string }).id)
    fake.calls = []
    fake.failOn = null
    await expect(submit(input())).rejects.toThrow('REDIRECT:/today')
    const retryIds = events().map((call) => (call.at(-1) as { id: string }).id)
    expect(retryIds.slice(0, firstIds.length)).toEqual(firstIds)
  })

  it("sends a new track.enrolled id — with the new budget — on an edited resubmit after a partial failure (M2 RF-2 'digest keys')", async () => {
    fake.failOn = { type: 'onboarding.completed', error: new EventError('unknown') }
    await submit(input())
    const firstDsaId = learnerEvents('track.enrolled').find((event) => event.trackId === 'dsa')?.id
    fake.calls = []
    fake.failOn = null
    const edited = input({
      tracks: [
        { trackId: 'dsa', budgetMinutes: 90, roadmapVariant: '10w' },
        { trackId: 'english', budgetMinutes: 25, roadmapVariant: '10w' },
      ],
    })
    await expect(submit(edited)).rejects.toThrow('REDIRECT:/today')
    const dsaEvent = learnerEvents('track.enrolled').find((event) => event.trackId === 'dsa')
    expect(dsaEvent?.payload.budgetMinutes).toBe(90)
    expect(dsaEvent?.id).not.toBe(firstDsaId)
  })
})

describe('completeOnboarding — orphan enrollments (M2 minor)', () => {
  it('removes an active enrollment the final selection no longer contains', async () => {
    fake.enrollments = [{ trackId: 'dsa', status: 'active' }]
    const englishOnly = input({ tracks: [input().tracks[1]!], codeLanguage: undefined })
    await expect(submit(englishOnly)).rejects.toThrow('REDIRECT:/today')
    expect(learnerEvent('track.removed')).toMatchObject({
      id: id(trackRemovedKey('dsa')),
      type: 'track.removed',
      trackId: 'dsa',
      payload: {},
    })
    // Removed strictly before onboarding.completed.
    const types = eventTypes()
    expect(types.indexOf('track.removed')).toBeLessThan(types.indexOf('onboarding.completed'))
  })

  it('removes nothing when the final selection still contains every active track', async () => {
    fake.enrollments = [
      { trackId: 'dsa', status: 'active' },
      { trackId: 'english', status: 'active' },
    ]
    await expect(submit(input())).rejects.toThrow('REDIRECT:/today')
    expect(eventTypes()).not.toContain('track.removed')
  })

  it('removes nothing when there is no active enrollment yet (a fresh onboarding)', async () => {
    fake.enrollments = []
    await expect(submit(input())).rejects.toThrow('REDIRECT:/today')
    expect(eventTypes()).not.toContain('track.removed')
  })

  it('re-enrols a removed track with a distinct id instead of a no-op duplicate (M2 minor, A→B→A within one render)', async () => {
    // dsa was enrolled, then removed, earlier in this same render (a prior submission attempt);
    // the learner re-selects it now with the exact same fields it had the first time.
    fake.enrollments = [{ trackId: 'dsa', status: 'removed' }]
    const neverEnrolledId = id(
      trackEnrolledKey('dsa', {
        roadmapVariant: '10w',
        budgetMinutes: 75,
        startDate: '2026-09-24',
        currentStatus: null,
      }),
    )
    await expect(submit(input())).rejects.toThrow('REDIRECT:/today')
    const dsaEvent = learnerEvents('track.enrolled').find((event) => event.trackId === 'dsa')
    expect(dsaEvent?.id).not.toBe(neverEnrolledId)
    expect(dsaEvent?.payload).toEqual({
      roadmapVariant: '10w',
      budgetMinutes: 75,
      startDate: '2026-09-24',
    })
  })
})

describe('completeOnboarding — the start date (decision 22)', () => {
  it('sends a past start date as today', async () => {
    await expect(submit(input({ startDate: '2026-09-01' }))).rejects.toThrow('REDIRECT:/today')
    expect(learnerEvent('track.enrolled')?.payload.startDate).toBe('2026-09-24')
  })

  it("computes today with the learner's own schedule (day start 00:00 vs 04:00)", async () => {
    // 03:30 on 2026-09-25 in Ho Chi Minh City: still the 24th with a 04:00 day start.
    vi.setSystemTime(new Date('2026-09-24T20:30:00.000Z'))
    await expect(submit(input({ startDate: '2026-09-01', dayStartsAt: '00:00' }))).rejects.toThrow(
      'REDIRECT:/today',
    )
    expect(learnerEvent('track.enrolled')?.payload.startDate).toBe('2026-09-25')
    fake.calls = []
    await expect(submit(input({ startDate: '2026-09-01' }))).rejects.toThrow('REDIRECT:/today')
    expect(learnerEvent('track.enrolled')?.payload.startDate).toBe('2026-09-24')
  })

  it('accepts a start date 60 days ahead', async () => {
    await expect(submit(input({ startDate: '2026-11-23' }))).rejects.toThrow('REDIRECT:/today')
    expect(learnerEvent('track.enrolled')?.payload.startDate).toBe('2026-11-23')
  })

  it('refuses a start date 61 days ahead, without events', async () => {
    await expect(submit(input({ startDate: '2026-11-24' }))).resolves.toEqual({
      status: 'error',
      formError: null,
      fieldErrors: { startDate: 'Ngày bắt đầu chỉ được muộn nhất 60 ngày kể từ hôm nay.' },
    })
    expect(events()).toEqual([])
  })
})

describe('completeOnboarding — checks against the active tracks', () => {
  it('refuses a roadmap variant the track does not have', async () => {
    const tracks = [{ trackId: 'dsa', budgetMinutes: 60, roadmapVariant: '12w' }]
    await expect(submit(input({ tracks }))).resolves.toEqual({
      status: 'error',
      formError: null,
      fieldErrors: { 'tracks.dsa.roadmapVariant': 'Chọn một phiên bản có trong lộ trình.' },
    })
    expect(events()).toEqual([])
  })

  it('refuses a track that is not active', async () => {
    const tracks = [{ trackId: 'system-design', budgetMinutes: 60, roadmapVariant: '10w' }]
    const result = await submit(input({ tracks, codeLanguage: undefined }))
    expect(result).toEqual({
      status: 'error',
      formError: null,
      fieldErrors: { tracks: 'Lộ trình này hiện không có. Bạn tải lại trang nhé.' },
    })
    expect(events()).toEqual([])
  })

  it('requires a code language when a selected track uses one', async () => {
    await expect(submit(input({ codeLanguage: undefined }))).resolves.toEqual({
      status: 'error',
      formError: null,
      fieldErrors: { codeLanguage: 'Chọn Python, Java hoặc Go.' },
    })
    expect(events()).toEqual([])
  })

  it('refuses a code language when no selected track uses one', async () => {
    const englishOnly = input({ tracks: [input().tracks[1]!] })
    await expect(submit(englishOnly)).resolves.toEqual({
      status: 'error',
      formError: null,
      fieldErrors: { codeLanguage: 'Lộ trình bạn chọn không dùng ngôn ngữ lập trình.' },
    })
    expect(events()).toEqual([])
  })

  it('refuses a time zone Intl does not know', async () => {
    await expect(submit(input({ timezone: 'Mars/Olympus_Mons' }))).resolves.toEqual({
      status: 'error',
      formError: null,
      fieldErrors: { timezone: 'Múi giờ không hợp lệ.' },
    })
    expect(events()).toEqual([])
  })

  it('refuses a time zone Intl accepts but the picker does not offer (ruling R17)', async () => {
    // Intl accepts any capitalisation; only timeZoneOptions() spellings are stored.
    await expect(submit(input({ timezone: 'asia/tokyo' }))).resolves.toEqual({
      status: 'error',
      formError: null,
      fieldErrors: { timezone: 'Múi giờ không hợp lệ.' },
    })
    expect(events()).toEqual([])
  })
})

describe('completeOnboarding — invalid payloads', () => {
  it('returns a form error for a payload that is not JSON, without events', async () => {
    await expect(submit('{not json')).resolves.toEqual({
      status: 'error',
      formError: 'Không đọc được thông tin thiết lập. Bạn tải lại trang rồi thử lại nhé.',
      fieldErrors: {},
    })
    expect(events()).toEqual([])
  })

  it('returns a form error when the payload is missing', async () => {
    const result = await completeOnboarding({ status: 'idle' }, new FormData())
    expect(result).toMatchObject({ status: 'error', fieldErrors: {} })
    expect(events()).toEqual([])
  })

  it('returns field errors for a payload the schema rejects', async () => {
    const tracks = [{ trackId: 'dsa', budgetMinutes: 62, roadmapVariant: '8w' }]
    await expect(submit(input({ tracks, dayStartsAt: '13:00' }))).resolves.toEqual({
      status: 'error',
      formError: null,
      fieldErrors: {
        'tracks.dsa.budgetMinutes': 'Nhập số phút từ 10 đến 240, bước 5 phút.',
        dayStartsAt: 'Chọn giờ từ 00:00 đến 12:00, mỗi 30 phút.',
      },
    })
    expect(events()).toEqual([])
  })
})

describe('completeOnboarding — guards and failures', () => {
  it('redirects an onboarded user to /today without any event', async () => {
    fake.user = { id: USER_ID, onboardedAt: '2026-09-20T00:00:00Z' }
    await expect(submit(input())).rejects.toThrow('REDIRECT:/today')
    expect(fake.calls).toEqual([['requireActive'], ['redirect', '/today']])
  })

  it('shows the §4.5 message when the write quota is exceeded, and does not complete', async () => {
    fake.failOn = { type: 'track.enrolled', error: new EventError('quota_exceeded') }
    await expect(submit(input())).resolves.toEqual({
      status: 'error',
      formError: 'Bạn đã ghi nhận quá nhiều hoạt động hôm nay. Hãy thử lại vào ngày mai.',
      fieldErrors: {},
    })
    expect(eventTypes()).not.toContain('onboarding.completed')
    expect(fake.calls.map(([name]) => name)).not.toContain('redirect')
  })

  it('puts a time zone the database rejects on the time-zone field', async () => {
    fake.failOn = { type: 'schedule.changed', error: new EventError('invalid_timezone') }
    await expect(submit(input())).resolves.toEqual({
      status: 'error',
      formError: null,
      fieldErrors: { timezone: 'Múi giờ không hợp lệ.' },
    })
  })

  it('rethrows anything that is not an EventError (the error boundary shows it)', async () => {
    fake.failOn = { type: 'schedule.changed', error: new Error('network down') }
    await expect(submit(input())).rejects.toThrow('network down')
  })
})
