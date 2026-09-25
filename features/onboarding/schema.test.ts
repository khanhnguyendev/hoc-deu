import { describe, expect, it } from 'vitest'
import {
  onboardingFieldErrors,
  onboardingInputSchema,
  trackFieldKey,
  type OnboardingInput,
} from './schema'

const REQUEST_ID = '0f8d6a52-3b1c-4d7e-9a2f-6c5b4e3d2a10'

const valid: OnboardingInput = {
  requestId: REQUEST_ID,
  tracks: [
    { trackId: 'dsa', budgetMinutes: 75, roadmapVariant: '10w' },
    { trackId: 'english', budgetMinutes: 25, roadmapVariant: '10w' },
  ],
  startDate: '2026-09-24',
  timezone: 'Asia/Ho_Chi_Minh',
  dayStartsAt: '04:00',
  codeLanguage: 'python',
}

const withTrack = (patch: Partial<OnboardingInput['tracks'][number]>) => ({
  ...valid,
  tracks: [{ ...valid.tracks[0]!, ...patch }],
})

describe('onboardingInputSchema', () => {
  it('accepts a complete input', () => {
    expect(onboardingInputSchema.parse(valid)).toEqual(valid)
  })

  it('accepts an input without a code language (English only)', () => {
    const input: Record<string, unknown> = { ...valid, tracks: [valid.tracks[1]!] }
    delete input.codeLanguage
    expect(onboardingInputSchema.parse(input)).not.toHaveProperty('codeLanguage')
  })

  it.each(['04:15', '13:00', '4:00', ''])('rejects the day start %j', (dayStartsAt) => {
    expect(onboardingInputSchema.safeParse({ ...valid, dayStartsAt }).success).toBe(false)
  })

  it.each([7, 245, 62, 60.5, 0])('rejects %j minutes per day', (budgetMinutes) => {
    expect(onboardingInputSchema.safeParse(withTrack({ budgetMinutes })).success).toBe(false)
  })

  it.each([10, 60, 240])('accepts %j minutes per day', (budgetMinutes) => {
    expect(onboardingInputSchema.safeParse(withTrack({ budgetMinutes })).success).toBe(true)
  })

  it('rejects an empty track list', () => {
    expect(onboardingInputSchema.safeParse({ ...valid, tracks: [] }).success).toBe(false)
  })

  it('rejects the same track twice', () => {
    const tracks = [valid.tracks[0]!, { ...valid.tracks[0]!, budgetMinutes: 90 }]
    expect(onboardingInputSchema.safeParse({ ...valid, tracks }).success).toBe(false)
  })

  it('rejects an unknown key, at the top level and inside a track', () => {
    expect(onboardingInputSchema.safeParse({ ...valid, theme: 'dark' }).success).toBe(false)
    expect(onboardingInputSchema.safeParse(withTrack({ extra: 1 } as never)).success).toBe(false)
  })

  it.each(['not-a-uuid', '', 42])('rejects the request id %j', (requestId) => {
    expect(onboardingInputSchema.safeParse({ ...valid, requestId }).success).toBe(false)
  })

  it.each(['2026-02-30', '24/09/2026', ''])('rejects the start date %j', (startDate) => {
    expect(onboardingInputSchema.safeParse({ ...valid, startDate }).success).toBe(false)
  })

  it('rejects an empty time zone and an unknown code language', () => {
    expect(onboardingInputSchema.safeParse({ ...valid, timezone: '' }).success).toBe(false)
    expect(onboardingInputSchema.safeParse({ ...valid, codeLanguage: 'rust' }).success).toBe(false)
  })
})

describe('onboardingFieldErrors', () => {
  const errorsOf = (input: unknown) => {
    const result = onboardingInputSchema.safeParse(input)
    if (result.success) throw new Error('expected the input to be rejected')
    return onboardingFieldErrors(result.error, input)
  }

  it('keys a track field by its track id, with the Vietnamese message', () => {
    expect(errorsOf(withTrack({ budgetMinutes: 62 }))).toEqual({
      formError: null,
      fieldErrors: {
        [trackFieldKey('dsa', 'budgetMinutes')]: 'Nhập số phút từ 10 đến 240, bước 5 phút.',
      },
    })
    expect(trackFieldKey('dsa', 'budgetMinutes')).toBe('tracks.dsa.budgetMinutes')
  })

  it('reports an empty or duplicated track list on `tracks`', () => {
    expect(errorsOf({ ...valid, tracks: [] }).fieldErrors).toEqual({
      tracks: 'Chọn ít nhất một lộ trình.',
    })
    const twice = { ...valid, tracks: [valid.tracks[0]!, valid.tracks[0]!] }
    expect(errorsOf(twice).fieldErrors).toEqual({ tracks: 'Mỗi lộ trình chỉ được chọn một lần.' })
  })

  it('reports schedule fields by name', () => {
    expect(errorsOf({ ...valid, dayStartsAt: '13:00', startDate: 'x' }).fieldErrors).toEqual({
      dayStartsAt: 'Chọn giờ từ 00:00 đến 12:00, mỗi 30 phút.',
      startDate: 'Chọn một ngày bắt đầu hợp lệ.',
    })
  })

  it('turns a bad request id or an unknown key into a form error', () => {
    const invalid = 'Không đọc được thông tin thiết lập. Bạn tải lại trang rồi thử lại nhé.'
    expect(errorsOf({ ...valid, requestId: 'x' })).toEqual({ formError: invalid, fieldErrors: {} })
    expect(errorsOf({ ...valid, theme: 'dark' })).toEqual({ formError: invalid, fieldErrors: {} })
    expect(errorsOf(null)).toEqual({ formError: invalid, fieldErrors: {} })
  })
})
