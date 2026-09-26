import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveEventId } from '@/lib/events/ids'
import type { SettingsAction } from './schema'

const REQUEST_ID = '0f8d6a52-3b1c-4d7e-9a2f-6c5b4e3d2a10'
const USER_ID = '5b0c61a2-7f5e-4c3b-9a41-2f1d7c8e9a10'
/** 10:00 in Asia/Ho_Chi_Minh (local day 2026-09-24 with a 04:00 day start). */
const NOW = '2026-09-24T03:00:00.000Z'
/** The next 04:00 in Asia/Ho_Chi_Minh after NOW: 2026-09-25 04:00 +07:00. */
const NEXT_VN_DAY_START = '2026-09-24T21:00:00.000Z'

const DSA = 'Cấu trúc dữ liệu & Giải thuật'
const ENGLISH = 'Tiếng Anh cho môi trường IT'

type Version = { timezone: string; dayStartsAt: string; effectiveAt: string }
type Enrollment = {
  trackId: string
  status: 'active' | 'paused' | 'removed'
  budgetMinutes: number
  roadmapVariant: string
  startDate: string
}

const fake = vi.hoisted(() => ({
  user: { id: '', codeLanguage: null as string | null },
  versions: [] as Version[],
  enrollments: [] as Enrollment[],
  /** The local day of the latest `track.paused` event, per track. */
  pausedDays: {} as Record<string, string>,
  /** Throw this from the apply call with this event type. */
  failOn: null as { type: string; error: Error } | null,
  /** `deleteAccount`: what the admin API's `deleteUser` returns. */
  deleteUserResult: { error: null as { message: string } | null },
  /** `deleteAccount`: what its local `signOut` returns. */
  deleteAccountSignOutResult: { error: null as Error | null },
  calls: [] as unknown[][],
}))

vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => {
    fake.calls.push(['revalidatePath', path])
  },
}))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    fake.calls.push(['redirect', to])
    throw new Error(`REDIRECT:${to}`)
  },
}))
vi.mock('@/lib/auth/dal', () => ({
  requireOnboarded: async () => {
    fake.calls.push(['requireOnboarded'])
    return fake.user
  },
  requireUser: async () => {
    fake.calls.push(['requireUser'])
    return fake.user
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    client: 'user',
    auth: {
      signOut: async (options: unknown) => {
        fake.calls.push(['signOut', options])
        return fake.deleteAccountSignOutResult
      },
    },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        deleteUser: async (userId: string) => {
          fake.calls.push(['deleteUser', userId])
          return fake.deleteUserResult
        },
      },
    },
  }),
}))
vi.mock('./reads', () => ({
  readScheduleVersions: async (_client: unknown, userId: string) => {
    fake.calls.push(['readScheduleVersions', userId])
    return fake.versions
  },
  readEnrollments: async (_client: unknown, userId: string) => {
    fake.calls.push(['readEnrollments', userId])
    return fake.enrollments
  },
  readLastPausedDay: async (_client: unknown, userId: string, trackId: string) => {
    fake.calls.push(['readLastPausedDay', userId, trackId])
    return fake.pausedDays[trackId] ?? null
  },
}))
vi.mock('@/lib/events/apply', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/events/apply')>()
  return {
    ...actual,
    applyLearnerEvent: async (client: { client: string }, event: { type: string }) => {
      fake.calls.push(['applyLearnerEvent', client.client, event])
      if (fake.failOn?.type === event.type) throw fake.failOn.error
      return 'applied'
    },
  }
})

const { EventError } = await import('@/lib/events/apply')
const {
  deleteAccount,
  enrollTrack,
  setTrackStatus,
  updateCodeLanguage,
  updateSchedule,
  updateTrack,
} = await import('./actions')

const id = (key: string) => deriveEventId(REQUEST_ID, key)
const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}
const events = () => fake.calls.filter(([name]) => name === 'applyLearnerEvent')
const sent = () => events().map((call) => call.at(-1))
const revalidated = () => fake.calls.filter(([name]) => name === 'revalidatePath')

const VN: Version = {
  timezone: 'Asia/Ho_Chi_Minh',
  dayStartsAt: '04:00',
  effectiveAt: '2026-09-01T00:00:00.000Z',
}
const enrolled = (patch: Partial<Enrollment> & Pick<Enrollment, 'trackId'>): Enrollment => ({
  status: 'active',
  budgetMinutes: 60,
  roadmapVariant: '8w',
  startDate: '2026-09-01',
  ...patch,
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(NOW) })
  fake.user = { id: USER_ID, codeLanguage: 'python' }
  fake.versions = [VN]
  fake.enrollments = [
    enrolled({ trackId: 'dsa' }),
    enrolled({ trackId: 'english', budgetMinutes: 25, roadmapVariant: '10w' }),
  ]
  fake.pausedDays = {}
  fake.failOn = null
  fake.deleteUserResult = { error: null }
  fake.deleteAccountSignOutResult = { error: null }
  fake.calls = []
})
afterEach(() => {
  vi.useRealTimers()
})

describe('updateSchedule — a change takes effect at the next day start (§5.9)', () => {
  const save = (fields: Record<string, string>) =>
    updateSchedule(null, form({ requestId: REQUEST_ID, ...fields }))

  it('guards first, then records the change at the next 04:00 in the zone in force', async () => {
    const result = await save({ timezone: 'America/Los_Angeles', dayStartsAt: '04:00' })
    expect(fake.calls[0]).toEqual(['requireOnboarded'])
    expect(sent()).toEqual([
      {
        id: id('schedule.changed'),
        type: 'schedule.changed',
        payload: {
          timezone: 'America/Los_Angeles',
          dayStartsAt: '04:00',
          effectiveAt: NEXT_VN_DAY_START,
        },
      },
    ])
    expect(result).toEqual({
      ok: true,
      message:
        'Thay đổi áp dụng từ 25 tháng 9, 2026 lúc 04:00 (giờ Asia/Ho_Chi_Minh) — ngày đang học không bị ảnh hưởng.',
    })
    expect(revalidated()).toEqual([['revalidatePath', '/settings']])
  })

  it('uses the day start of the schedule in force, in its own zone (Los Angeles)', async () => {
    // 2026-09-23 20:00 PDT: the next 04:00 in Los Angeles is 2026-09-24 04:00 PDT (11:00 UTC).
    fake.versions = [{ ...VN, timezone: 'America/Los_Angeles' }]
    await save({ timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '04:00' })
    expect(sent()).toMatchObject([{ payload: { effectiveAt: '2026-09-24T11:00:00.000Z' } }])
  })

  it('records a day-start change the same way', async () => {
    await save({ timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '06:30' })
    expect(sent()).toMatchObject([
      { payload: { dayStartsAt: '06:30', effectiveAt: NEXT_VN_DAY_START } },
    ])
  })

  it('stores Asia/Saigon as Asia/Ho_Chi_Minh (decision 6)', async () => {
    await save({ timezone: 'Asia/Saigon', dayStartsAt: '05:00' })
    expect(sent()).toMatchObject([{ payload: { timezone: 'Asia/Ho_Chi_Minh' } }])
  })

  it('sends nothing when the values equal the schedule in force', async () => {
    const result = await save({ timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '04:00' })
    expect(events()).toEqual([])
    expect(revalidated()).toEqual([])
    expect(result).toEqual({ ok: true, message: 'Lịch học không thay đổi.' })
  })

  it('sends nothing when the values equal the pending change', async () => {
    fake.versions = [
      VN,
      { timezone: 'America/Los_Angeles', dayStartsAt: '04:00', effectiveAt: NEXT_VN_DAY_START },
    ]
    const result = await save({ timezone: 'America/Los_Angeles', dayStartsAt: '04:00' })
    expect(events()).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('switching back to the schedule in force replaces the pending change at its effectiveAt', async () => {
    const pendingAt = '2026-09-24T21:00:00+00:00'
    fake.versions = [
      VN,
      { timezone: 'America/Los_Angeles', dayStartsAt: '04:00', effectiveAt: pendingAt },
    ]
    const result = await save({ timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '04:00' })
    expect(sent()).toEqual([
      {
        id: id('schedule.changed'),
        type: 'schedule.changed',
        payload: {
          timezone: 'Asia/Ho_Chi_Minh',
          dayStartsAt: '04:00',
          effectiveAt: NEXT_VN_DAY_START,
        },
      },
    ])
    expect(result).toEqual({ ok: true, message: 'Đã huỷ thay đổi lịch học đang chờ.' })
    expect(revalidated()).toEqual([['revalidatePath', '/settings']])
  })

  it('another change while one is pending replaces it at the same effectiveAt', async () => {
    fake.versions = [
      VN,
      { timezone: 'America/Los_Angeles', dayStartsAt: '04:00', effectiveAt: NEXT_VN_DAY_START },
    ]
    await save({ timezone: 'Asia/Tokyo', dayStartsAt: '04:00' })
    expect(sent()).toMatchObject([
      { payload: { timezone: 'Asia/Tokyo', effectiveAt: NEXT_VN_DAY_START } },
    ])
  })

  it('a pending version equal to the schedule in force counts as no change pending', async () => {
    fake.versions = [VN, { ...VN, effectiveAt: NEXT_VN_DAY_START }]
    await expect(save({ timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '04:00' })).resolves.toEqual({
      ok: true,
      message: 'Lịch học không thay đổi.',
    })
    expect(events()).toEqual([])
  })

  it('uses the default schedule when the learner has no version yet', async () => {
    fake.versions = []
    await save({ timezone: 'Europe/London', dayStartsAt: '04:00' })
    expect(sent()).toMatchObject([{ payload: { effectiveAt: NEXT_VN_DAY_START } }])
  })

  it('refuses a time zone Intl does not know, without events', async () => {
    await expect(save({ timezone: 'Mars/Olympus_Mons', dayStartsAt: '04:00' })).resolves.toEqual({
      ok: false,
      message: 'Kiểm tra lại các mục được đánh dấu.',
      fieldErrors: { timezone: 'Múi giờ không hợp lệ.' },
    })
    expect(events()).toEqual([])
  })

  it('refuses a time zone Intl accepts but the picker does not offer (ruling R17)', async () => {
    // Intl accepts any capitalisation; only timeZoneOptions() spellings are stored.
    await expect(save({ timezone: 'asia/tokyo', dayStartsAt: '04:00' })).resolves.toEqual({
      ok: false,
      message: 'Kiểm tra lại các mục được đánh dấu.',
      fieldErrors: { timezone: 'Múi giờ không hợp lệ.' },
    })
    expect(events()).toEqual([])
  })

  it('refuses a day start outside 00:00–12:00 in 30-minute steps', async () => {
    await expect(save({ timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '13:00' })).resolves.toEqual({
      ok: false,
      message: 'Kiểm tra lại các mục được đánh dấu.',
      fieldErrors: { dayStartsAt: 'Chọn giờ từ 00:00 đến 12:00, mỗi 30 phút.' },
    })
    expect(events()).toEqual([])
  })

  it('refuses a missing or malformed requestId as a form error', async () => {
    const result = await updateSchedule(
      null,
      form({ requestId: 'nope', timezone: 'Asia/Tokyo', dayStartsAt: '04:00' }),
    )
    expect(result).toEqual({
      ok: false,
      message: 'Không đọc được yêu cầu. Bạn tải lại trang rồi thử lại nhé.',
    })
    expect(events()).toEqual([])
  })

  it('shows the EventError message when the database refuses (quota)', async () => {
    fake.failOn = { type: 'schedule.changed', error: new EventError('quota_exceeded') }
    await expect(save({ timezone: 'Asia/Tokyo', dayStartsAt: '04:00' })).resolves.toEqual({
      ok: false,
      message: 'Bạn đã ghi nhận quá nhiều hoạt động hôm nay. Hãy thử lại vào ngày mai.',
    })
    expect(revalidated()).toEqual([])
  })

  it.each([
    [
      'too_many_pending_schedules',
      'Đã có một thay đổi lịch đang chờ áp dụng. Bạn tải lại trang nhé.',
    ],
    ['schedule_in_force', 'Không lưu được thay đổi. Bạn thử lại nhé.'],
    ['schedule_backdated', 'Không lưu được thay đổi. Bạn thử lại nhé.'],
  ] as const)(
    'shows the message for %s and re-renders the page (its schedules changed, ruling R17)',
    async (code, message) => {
      fake.failOn = { type: 'schedule.changed', error: new EventError(code) }
      await expect(save({ timezone: 'Asia/Tokyo', dayStartsAt: '04:00' })).resolves.toEqual({
        ok: false,
        message,
      })
      expect(revalidated()).toEqual([['revalidatePath', '/settings']])
    },
  )

  it('puts a zone the database rejects on the time-zone field', async () => {
    fake.failOn = { type: 'schedule.changed', error: new EventError('invalid_timezone') }
    await expect(save({ timezone: 'Asia/Tokyo', dayStartsAt: '04:00' })).resolves.toEqual({
      ok: false,
      message: 'Kiểm tra lại các mục được đánh dấu.',
      fieldErrors: { timezone: 'Múi giờ không hợp lệ.' },
    })
  })

  it('rethrows anything that is not an EventError (the error boundary shows it)', async () => {
    fake.failOn = { type: 'schedule.changed', error: new Error('network down') }
    await expect(save({ timezone: 'Asia/Tokyo', dayStartsAt: '04:00' })).rejects.toThrow(
      'network down',
    )
  })
})

describe('updateCodeLanguage', () => {
  const save = (codeLanguage: string) =>
    updateCodeLanguage(null, form({ requestId: REQUEST_ID, codeLanguage }))

  it('records settings.changed with the new language', async () => {
    const result = await save('java')
    expect(fake.calls[0]).toEqual(['requireOnboarded'])
    expect(sent()).toEqual([
      {
        id: id('settings.changed:codeLanguage'),
        type: 'settings.changed',
        payload: { codeLanguage: 'java' },
      },
    ])
    expect(result).toEqual({ ok: true, message: 'Đã lưu ngôn ngữ lập trình.' })
    expect(revalidated()).toEqual([['revalidatePath', '/settings']])
  })

  it('sends nothing for the language already saved', async () => {
    await expect(save('python')).resolves.toEqual({
      ok: true,
      message: 'Ngôn ngữ lập trình không thay đổi.',
    })
    expect(events()).toEqual([])
  })

  it('reads a profile without a language as Python (the default)', async () => {
    fake.user = { id: USER_ID, codeLanguage: null }
    await save('python')
    expect(events()).toEqual([])
    await save('go')
    expect(sent()).toMatchObject([{ payload: { codeLanguage: 'go' } }])
  })

  it('refuses a language that is not Python, Java or Go', async () => {
    await expect(save('rust')).resolves.toEqual({
      ok: false,
      message: 'Kiểm tra lại các mục được đánh dấu.',
      fieldErrors: { codeLanguage: 'Chọn Python, Java hoặc Go.' },
    })
    expect(events()).toEqual([])
  })
})

describe('updateTrack — minutes and roadmap variant', () => {
  const save = (fields: Record<string, string>) =>
    updateTrack(null, form({ requestId: REQUEST_ID, trackId: 'dsa', ...fields }))

  it('sends only the changed keys in track.updated', async () => {
    const result = await save({ budgetMinutes: '90', roadmapVariant: '8w' })
    expect(fake.calls[0]).toEqual(['requireOnboarded'])
    expect(sent()).toEqual([
      {
        id: id('track.updated:dsa'),
        type: 'track.updated',
        trackId: 'dsa',
        payload: { budgetMinutes: 90 },
      },
    ])
    expect(result).toEqual({ ok: true, message: `Đã lưu ${DSA}.` })
    expect(revalidated()).toEqual([['revalidatePath', '/settings']])
  })

  it('switches the roadmap variant (§5.9 "Switching 10w ↔ 8w")', async () => {
    await save({ budgetMinutes: '60', roadmapVariant: '10w' })
    expect(sent()).toMatchObject([{ payload: { roadmapVariant: '10w' } }])
    expect((sent()[0] as { payload: object }).payload).not.toHaveProperty('budgetMinutes')
  })

  it('sends nothing when nothing changed', async () => {
    await expect(save({ budgetMinutes: '60', roadmapVariant: '8w' })).resolves.toEqual({
      ok: true,
      message: 'Không có gì thay đổi.',
    })
    expect(events()).toEqual([])
    expect(revalidated()).toEqual([])
  })

  it('works for a paused track too', async () => {
    fake.enrollments = [enrolled({ trackId: 'dsa', status: 'paused' })]
    await save({ budgetMinutes: '45', roadmapVariant: '8w' })
    expect(sent()).toMatchObject([{ payload: { budgetMinutes: 45 } }])
  })

  it.each([
    ['not enrolled', []],
    ['removed', [{ trackId: 'dsa', status: 'removed' }]],
  ] as const)('refuses a track that is %s, and re-renders the page', async (_, rows) => {
    fake.enrollments = rows.map((row) => enrolled(row))
    await expect(save({ budgetMinutes: '90', roadmapVariant: '8w' })).resolves.toEqual({
      ok: false,
      message: 'Lộ trình đang ở trạng thái khác. Bạn tải lại trang nhé.',
    })
    expect(events()).toEqual([])
    expect(revalidated()).toEqual([['revalidatePath', '/settings']])
  })

  it('refuses minutes outside 10–240 in steps of 5', async () => {
    await expect(save({ budgetMinutes: '62', roadmapVariant: '8w' })).resolves.toEqual({
      ok: false,
      message: 'Kiểm tra lại các mục được đánh dấu.',
      fieldErrors: { budgetMinutes: 'Nhập số phút từ 10 đến 240, bước 5 phút.' },
    })
    expect(events()).toEqual([])
  })

  it('refuses a variant the track does not have', async () => {
    await expect(save({ budgetMinutes: '60', roadmapVariant: '12w' })).resolves.toEqual({
      ok: false,
      message: 'Kiểm tra lại các mục được đánh dấu.',
      fieldErrors: { roadmapVariant: 'Chọn một phiên bản có trong lộ trình.' },
    })
    expect(events()).toEqual([])
  })
})

describe('enrollTrack — "Thêm lộ trình"', () => {
  const add = (fields: Record<string, string>) =>
    enrollTrack(
      null,
      form({
        requestId: REQUEST_ID,
        trackId: 'dsa',
        budgetMinutes: '75',
        roadmapVariant: '10w',
        startDate: '2026-09-24',
        ...fields,
      }),
    )

  it('re-enrolls a removed track (history is kept, §5.9)', async () => {
    fake.enrollments = [enrolled({ trackId: 'dsa', status: 'removed' })]
    const result = await add({})
    expect(fake.calls[0]).toEqual(['requireOnboarded'])
    expect(sent()).toEqual([
      {
        id: id('track.enrolled:dsa'),
        type: 'track.enrolled',
        trackId: 'dsa',
        payload: { roadmapVariant: '10w', budgetMinutes: 75, startDate: '2026-09-24' },
      },
    ])
    expect(result).toEqual({ ok: true, message: `Đã thêm ${DSA}.` })
    expect(revalidated()).toEqual([['revalidatePath', '/settings']])
  })

  it('enrolls a track the learner never had', async () => {
    fake.enrollments = []
    await add({ trackId: 'english', budgetMinutes: '25', startDate: '2026-10-01' })
    expect(sent()).toMatchObject([
      { trackId: 'english', payload: { budgetMinutes: 25, startDate: '2026-10-01' } },
    ])
  })

  it('sends a past start date as today, in the schedule in force (decision 22)', async () => {
    fake.enrollments = []
    await add({ startDate: '2026-09-01' })
    expect(sent()).toMatchObject([{ payload: { startDate: '2026-09-24' } }])
  })

  it('refuses a start date more than 60 days ahead', async () => {
    fake.enrollments = []
    await expect(add({ startDate: '2026-11-24' })).resolves.toEqual({
      ok: false,
      message: 'Kiểm tra lại các mục được đánh dấu.',
      fieldErrors: { startDate: 'Ngày bắt đầu chỉ được muộn nhất 60 ngày kể từ hôm nay.' },
    })
    expect(events()).toEqual([])
  })

  it.each(['active', 'paused'] as const)(
    'refuses a track that is already %s (no silent reset)',
    async (status) => {
      fake.enrollments = [enrolled({ trackId: 'dsa', status })]
      await expect(add({})).resolves.toEqual({
        ok: false,
        message: 'Lộ trình này đã có trong danh sách của bạn. Bạn tải lại trang nhé.',
      })
      expect(events()).toEqual([])
      expect(revalidated()).toEqual([['revalidatePath', '/settings']])
    },
  )

  it('refuses a track that is not active', async () => {
    fake.enrollments = []
    await expect(add({ trackId: 'system-design' })).resolves.toEqual({
      ok: false,
      message: 'Lộ trình này hiện không có. Bạn tải lại trang nhé.',
    })
    expect(events()).toEqual([])
  })

  it('refuses a variant the track does not have', async () => {
    fake.enrollments = []
    await expect(add({ roadmapVariant: '12w' })).resolves.toMatchObject({
      ok: false,
      fieldErrors: { roadmapVariant: 'Chọn một phiên bản có trong lộ trình.' },
    })
    expect(events()).toEqual([])
  })
})

describe('setTrackStatus — pause, resume, remove', () => {
  const set = (trackId: string, to: string) =>
    setTrackStatus(null, form({ requestId: REQUEST_ID, trackId, to }))

  it('pauses an active track', async () => {
    const result = await set('english', 'paused')
    expect(fake.calls[0]).toEqual(['requireOnboarded'])
    expect(sent()).toEqual([
      { id: id('track.paused:english'), type: 'track.paused', trackId: 'english', payload: {} },
    ])
    expect(result).toEqual({ ok: true, message: `Đã tạm dừng ${ENGLISH}.` })
    expect(revalidated()).toEqual([['revalidatePath', '/settings']])
  })

  it('resumes with pausedDays = days since the latest track.paused (§5.9)', async () => {
    fake.enrollments = [enrolled({ trackId: 'english', status: 'paused' })]
    fake.pausedDays = { english: '2026-09-20' }
    const result = await set('english', 'active')
    expect(fake.calls).toContainEqual(['readLastPausedDay', USER_ID, 'english'])
    expect(sent()).toEqual([
      {
        id: id('track.resumed:english'),
        type: 'track.resumed',
        trackId: 'english',
        payload: { pausedDays: 4 },
      },
    ])
    expect(result).toEqual({ ok: true, message: `Đã tiếp tục ${ENGLISH}.` })
  })

  it('counts the paused days in the schedule in force (still the 23rd before 04:00 VN)', async () => {
    // 03:30 on 2026-09-24 in Ho Chi Minh City: the learner's day is still 2026-09-23.
    vi.setSystemTime(new Date('2026-09-23T20:30:00.000Z'))
    fake.pausedDays = { english: '2026-09-20' }
    await set('english', 'active')
    expect(sent()).toMatchObject([{ payload: { pausedDays: 3 } }])
  })

  it('clamps pausedDays to MAX_PAUSED_DAYS, which the database accepts (decision 36)', async () => {
    fake.pausedDays = { english: '2010-01-01' }
    await set('english', 'active')
    expect(sent()).toMatchObject([{ payload: { pausedDays: 3650 } }])
  })

  it('resumes with pausedDays 0 when no pause event is found', async () => {
    await set('english', 'active')
    expect(sent()).toMatchObject([{ payload: { pausedDays: 0 } }])
  })

  it('removes a track', async () => {
    const result = await set('dsa', 'removed')
    expect(sent()).toEqual([
      { id: id('track.removed:dsa'), type: 'track.removed', trackId: 'dsa', payload: {} },
    ])
    expect(result).toEqual({ ok: true, message: `Đã gỡ ${DSA}.` })
  })

  it('shows the Vietnamese message for an invalid transition and re-renders the page', async () => {
    fake.failOn = { type: 'track.paused', error: new EventError('invalid_transition') }
    await expect(set('english', 'paused')).resolves.toEqual({
      ok: false,
      message: 'Lộ trình đang ở trạng thái khác. Bạn tải lại trang nhé.',
    })
    expect(revalidated()).toEqual([['revalidatePath', '/settings']])
  })

  it('refuses an unknown target status as a form error', async () => {
    await expect(set('english', 'reset')).resolves.toEqual({
      ok: false,
      message: 'Không đọc được yêu cầu. Bạn tải lại trang rồi thử lại nhé.',
    })
    expect(events()).toEqual([])
  })
})

describe('deleteAccount — §4.6', () => {
  // Assignable to SettingsAction (fewer parameters is fine): called the same way
  // useSettingsAction calls every other settings action.
  const run: SettingsAction = deleteAccount

  it('guards with requireUser (pending users may delete too), deletes, signs out locally, redirects', async () => {
    await expect(run(null, new FormData())).rejects.toThrow('REDIRECT:/?account=deleted')
    expect(fake.calls).toEqual([
      ['requireUser'],
      ['deleteUser', USER_ID],
      ['signOut', { scope: 'local' }],
      ['redirect', '/?account=deleted'],
    ])
  })

  it('returns a failure message instead of signing out or redirecting when the admin API errors', async () => {
    fake.deleteUserResult = { error: { message: 'boom' } }
    const result = await run(null, new FormData())
    expect(result).toEqual({ ok: false, message: 'Không xoá được tài khoản. Bạn thử lại nhé.' })
    expect(fake.calls).toEqual([['requireUser'], ['deleteUser', USER_ID]])
  })

  it('still redirects when the local sign-out fails, after the account is already deleted (controller ruling, M2 minor)', async () => {
    fake.deleteAccountSignOutResult = { error: new Error('cookies unavailable') }
    await expect(run(null, new FormData())).rejects.toThrow('REDIRECT:/?account=deleted')
    expect(fake.calls).toEqual([
      ['requireUser'],
      ['deleteUser', USER_ID],
      ['signOut', { scope: 'local' }],
      ['redirect', '/?account=deleted'],
    ])
  })
})
