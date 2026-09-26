import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Toaster } from '@/components/ui/toaster'
import type { TrackOption } from '@/lib/content/track-options'
import type { SettingsAction, SettingsResult, SettingsTrack } from '../schema'
import { AddTrackForm } from './add-track-form'

const REQUEST_ID = '0f8d6a52-3b1c-4d7e-9a2f-6c5b4e3d2a10'
/** 10:00 in Ho Chi Minh City: local day 2026-09-24 with a 04:00 day start. */
const NOW = '2026-09-24T03:00:00.000Z'
const VN = { timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '04:00' }
const DSA_TITLE = 'Cấu trúc dữ liệu & Giải thuật'
const ENGLISH_TITLE = 'Tiếng Anh cho môi trường IT'
const SD_TITLE = 'System Design'

const option = (patch: Partial<TrackOption> & Pick<TrackOption, 'id' | 'title'>): TrackOption => ({
  accent: 'track-1',
  defaultBudgetMinutes: 60,
  roadmaps: [{ id: '10w' }],
  codeLanguages: [],
  template: [{ label: 'Thứ 2 – Thứ 6', blocks: ['Ôn tập', 'Bài mới'] }],
  throttle: [],
  ...patch,
})

const DSA = option({
  id: 'dsa',
  title: DSA_TITLE,
  roadmaps: [{ id: '8w', recommendedBelowMinutes: 75 }, { id: '10w' }],
})
const ENGLISH = option({ id: 'english', title: ENGLISH_TITLE, defaultBudgetMinutes: 25 })
const SYSTEM_DESIGN = option({ id: 'system-design', title: SD_TITLE, defaultBudgetMinutes: 45 })

const TRACKS: SettingsTrack[] = [
  {
    option: DSA,
    enrollment: {
      status: 'removed',
      budgetMinutes: 90,
      roadmapVariant: '10w',
      startDate: '2026-09-01',
    },
  },
  {
    option: ENGLISH,
    enrollment: {
      status: 'active',
      budgetMinutes: 25,
      roadmapVariant: '10w',
      startDate: '2026-09-01',
    },
  },
  { option: SYSTEM_DESIGN, enrollment: null },
]

let run = 0

function setup(
  props: Partial<React.ComponentProps<typeof AddTrackForm>> = {},
  result?: SettingsResult,
) {
  run += 1
  const message = `Đã thêm (${run}).`
  const enrollTrack = vi.fn<SettingsAction>(async () => result ?? { ok: true, message })
  render(
    <>
      <AddTrackForm
        tracks={TRACKS}
        schedule={VN}
        now={NOW}
        requestId={REQUEST_ID}
        enrollTrack={enrollTrack}
        {...props}
      />
      <Toaster />
    </>,
  )
  return { enrollTrack, message, user: userEvent.setup() }
}

const trackChoice = (title: string) =>
  screen.getByRole('radio', { name: (name) => name.startsWith(title) })
const minutes = () => screen.getByRole('spinbutton', { name: 'Số phút mỗi ngày' })
const startDate = () => screen.getByLabelText('Ngày bắt đầu')
const submit = () => screen.getByRole('button', { name: 'Thêm lộ trình' })
const fields = (action: ReturnType<typeof vi.fn<SettingsAction>>) =>
  Object.fromEntries(action.mock.calls[0]![1].entries())

describe('AddTrackForm — the candidates', () => {
  it('offers removed and never-enrolled tracks — not the enrolled ones', () => {
    setup()
    const group = screen.getByRole('radiogroup', { name: 'Lộ trình' })
    expect(within(group).getAllByRole('radio')).toHaveLength(2)
    expect(trackChoice(DSA_TITLE)).toBeTruthy()
    expect(trackChoice(SD_TITLE)).toBeTruthy()
    expect(
      screen.queryByRole('radio', { name: (name) => name.startsWith(ENGLISH_TITLE) }),
    ).toBeNull()
  })

  it('marks a removed track "Đã gỡ" (re-adding keeps its history)', () => {
    setup()
    expect(trackChoice(DSA_TITLE).closest('label')?.textContent).toContain('Đã gỡ')
    expect(trackChoice(SD_TITLE).closest('label')?.textContent).not.toContain('Đã gỡ')
  })

  it('shows an empty state when every track is enrolled', () => {
    setup({ tracks: [TRACKS[1]!] })
    expect(
      screen.getByRole('heading', { name: 'Bạn đang học tất cả lộ trình hiện có' }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Thêm lộ trình' })).toBeNull()
  })
})

describe('AddTrackForm — the fields', () => {
  it('starts on the first candidate with its last minutes and variant, and today', () => {
    setup()
    expect(trackChoice(DSA_TITLE).getAttribute('aria-checked')).toBe('true')
    expect(minutes()).toHaveProperty('value', '90')
    expect(screen.getByRole('radio', { name: /^10 tuần/ }).getAttribute('aria-checked')).toBe(
      'true',
    )
    expect(startDate()).toHaveProperty('value', '2026-09-24')
    expect(startDate().getAttribute('min')).toBe('2026-09-24')
    expect(startDate().getAttribute('max')).toBe('2026-11-23')
  })

  it('a never-enrolled track starts at its default minutes, without a variant picker', async () => {
    const { user } = setup()
    await user.click(trackChoice(SD_TITLE))
    expect(minutes()).toHaveProperty('value', '45')
    expect(screen.queryByRole('radiogroup', { name: 'Phiên bản lộ trình' })).toBeNull()
  })

  it('"Thêm lộ trình" sends the requestId, the track, minutes, variant and start date', async () => {
    const { enrollTrack, message, user } = setup()
    await user.clear(minutes())
    await user.type(minutes(), '60')
    await user.click(screen.getByRole('radio', { name: /^8 tuần/ }))
    await user.click(submit())
    await waitFor(() => expect(enrollTrack).toHaveBeenCalledTimes(1))
    expect(fields(enrollTrack)).toEqual({
      requestId: REQUEST_ID,
      trackId: 'dsa',
      budgetMinutes: '60',
      roadmapVariant: '8w',
      startDate: '2026-09-24',
    })
    expect(await screen.findByText(message)).toBeTruthy()
  })

  it('sends the single roadmap of a track without a picker', async () => {
    const { enrollTrack, user } = setup()
    await user.click(trackChoice(SD_TITLE))
    await user.click(submit())
    await waitFor(() => expect(enrollTrack).toHaveBeenCalledTimes(1))
    expect(fields(enrollTrack)).toMatchObject({
      trackId: 'system-design',
      budgetMinutes: '45',
      roadmapVariant: '10w',
    })
  })

  it('shows field errors under the fields and the message in an alert', async () => {
    const { user } = setup(
      {},
      {
        ok: false,
        message: 'Kiểm tra lại các mục được đánh dấu.',
        fieldErrors: { startDate: 'Ngày bắt đầu chỉ được muộn nhất 60 ngày kể từ hôm nay.' },
      },
    )
    await user.click(submit())
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Kiểm tra lại các mục được đánh dấu.',
      ),
    )
    expect(startDate().getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('Ngày bắt đầu chỉ được muộn nhất 60 ngày kể từ hôm nay.')).toBeTruthy()
  })

  it('keeps the button busy for a still-running submit even after switching candidates, and never lets the switch borrow its result (M2 minor race)', async () => {
    let finish: (result: SettingsResult) => void = () => {}
    const enrollTrack = vi.fn<SettingsAction>(
      () => new Promise<SettingsResult>((resolve) => (finish = resolve)),
    )
    const { user } = setup({ enrollTrack })
    await user.click(submit())
    await waitFor(() => expect(submit().getAttribute('aria-busy')).toBe('true'))

    // Switching to another candidate mid-submit must not free up a second, real submit.
    await user.click(trackChoice(SD_TITLE))
    expect(submit().getAttribute('aria-busy')).toBe('true')
    await user.click(submit())
    expect(enrollTrack).toHaveBeenCalledTimes(1)

    finish({
      ok: false,
      message: 'Kiểm tra lại các mục được đánh dấu.',
      fieldErrors: { startDate: 'Ngày bắt đầu chỉ được muộn nhất 60 ngày kể từ hôm nay.' },
    })
    await waitFor(() => expect(submit().getAttribute('aria-busy')).toBeNull())
    // The first (DSA) submit's error never shows against the now-selected System Design fields.
    expect(screen.queryByText('Ngày bắt đầu chỉ được muộn nhất 60 ngày kể từ hôm nay.')).toBeNull()
  })

  it('clears the server errors and pending state when the candidate track changes (M2 minor)', async () => {
    const { user } = setup(
      {},
      {
        ok: false,
        message: 'Kiểm tra lại các mục được đánh dấu.',
        fieldErrors: { startDate: 'Ngày bắt đầu chỉ được muộn nhất 60 ngày kể từ hôm nay.' },
      },
    )
    await user.click(submit())
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Kiểm tra lại các mục được đánh dấu.',
      ),
    )
    await user.click(trackChoice(SD_TITLE))
    expect(screen.getByRole('alert').textContent).toBe('')
    expect(screen.queryByText('Ngày bắt đầu chỉ được muộn nhất 60 ngày kể từ hôm nay.')).toBeNull()
    expect(startDate().getAttribute('aria-invalid')).toBeNull()
  })
})
