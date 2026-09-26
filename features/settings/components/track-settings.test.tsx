import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Toaster } from '@/components/ui/toaster'
import type { TrackOption } from '@/lib/content/track-options'
import type { SettingsAction, SettingsResult, SettingsTrack } from '../schema'
import { TrackSettings } from './track-settings'

const REQUEST_ID = '0f8d6a52-3b1c-4d7e-9a2f-6c5b4e3d2a10'
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
  codeLanguages: ['python', 'java', 'go'],
})
const ENGLISH = option({
  id: 'english',
  title: ENGLISH_TITLE,
  accent: 'track-2',
  defaultBudgetMinutes: 25,
  throttle: ['Tối đa 8 thẻ mới mỗi ngày'],
})
const SYSTEM_DESIGN = option({ id: 'system-design', title: SD_TITLE, accent: 'track-3' })

const TRACKS: SettingsTrack[] = [
  {
    option: DSA,
    enrollment: {
      status: 'active',
      budgetMinutes: 60,
      roadmapVariant: '8w',
      startDate: '2026-09-01',
    },
  },
  {
    option: ENGLISH,
    enrollment: {
      status: 'paused',
      budgetMinutes: 25,
      roadmapVariant: '10w',
      startDate: '2026-09-01',
    },
  },
  { option: SYSTEM_DESIGN, enrollment: null },
]

let run = 0

function setup(
  props: Partial<React.ComponentProps<typeof TrackSettings>> = {},
  results: { update?: SettingsResult; status?: SettingsResult } = {},
) {
  run += 1
  const message = `Xong (${run}).`
  const updateTrack = vi.fn<SettingsAction>(async () => results.update ?? { ok: true, message })
  const setTrackStatus = vi.fn<SettingsAction>(async () => results.status ?? { ok: true, message })
  const view = render(
    <>
      <TrackSettings
        tracks={TRACKS}
        requestId={REQUEST_ID}
        updateTrack={updateTrack}
        setTrackStatus={setTrackStatus}
        {...props}
      />
      <Toaster />
    </>,
  )
  return { updateTrack, setTrackStatus, message, view, user: userEvent.setup() }
}

const region = (title: string) => screen.getByRole('region', { name: title })
const fields = (action: ReturnType<typeof vi.fn<SettingsAction>>, call = 0) =>
  Object.fromEntries(action.mock.calls[call]![1].entries())

describe('TrackSettings — the enrolled tracks', () => {
  it('lists active and paused tracks, each with its status badge — not the others', () => {
    setup()
    expect(within(region(DSA_TITLE)).getByText('Đang học')).toBeTruthy()
    expect(within(region(ENGLISH_TITLE)).getByText('Tạm dừng')).toBeTruthy()
    expect(screen.queryByRole('region', { name: SD_TITLE })).toBeNull()
  })

  it('leaves out a removed track', () => {
    setup({
      tracks: [
        {
          option: DSA,
          enrollment: {
            status: 'removed',
            budgetMinutes: 60,
            roadmapVariant: '8w',
            startDate: '2026-09-01',
          },
        },
      ],
    })
    expect(screen.queryByRole('region', { name: DSA_TITLE })).toBeNull()
  })

  it('shows an empty state when no track is enrolled', () => {
    setup({ tracks: [{ option: SYSTEM_DESIGN, enrollment: null }] })
    expect(screen.getByRole('heading', { name: 'Bạn chưa học lộ trình nào' })).toBeTruthy()
  })

  it('shows the minutes and the variant with the simulated finish (DSA)', () => {
    setup()
    const dsa = region(DSA_TITLE)
    expect(within(dsa).getByRole('spinbutton', { name: 'Số phút mỗi ngày' })).toHaveProperty(
      'value',
      '60',
    )
    const group = within(dsa).getByRole('radiogroup', { name: 'Phiên bản lộ trình' })
    const eight = within(group).getByRole('radio', { name: /^8 tuần/ })
    expect(eight.getAttribute('aria-checked')).toBe('true')
    expect(within(dsa).getByText(/lộ trình 8 tuần thường hoàn thành sau/)).toBeTruthy()
  })

  it('shows a single-roadmap track`s variant as text, without a picker (English)', () => {
    setup()
    const english = region(ENGLISH_TITLE)
    expect(within(english).queryByRole('radiogroup')).toBeNull()
    expect(within(english).getByText('10 tuần')).toBeTruthy()
  })

  it('shows the weekly template and throttle read-only', () => {
    setup()
    const english = region(ENGLISH_TITLE)
    expect(within(english).getByText('Thứ 2 – Thứ 6')).toBeTruthy()
    expect(within(english).getByText('Tối đa 8 thẻ mới mỗi ngày')).toBeTruthy()
    expect(within(english).queryByRole('textbox')).toBeNull()
  })
})

describe('TrackSettings — minutes and variant', () => {
  it('"Lưu" sends the requestId, the track and its minutes and variant', async () => {
    const { updateTrack, message, user } = setup()
    const dsa = region(DSA_TITLE)
    const minutes = within(dsa).getByRole('spinbutton', { name: 'Số phút mỗi ngày' })
    await user.clear(minutes)
    await user.type(minutes, '90')
    await user.click(within(dsa).getByRole('radio', { name: /^10 tuần/ }))
    await user.click(within(dsa).getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(updateTrack).toHaveBeenCalledTimes(1))
    expect(fields(updateTrack)).toEqual({
      requestId: REQUEST_ID,
      trackId: 'dsa',
      budgetMinutes: '90',
      roadmapVariant: '10w',
    })
    expect(await screen.findByText(message)).toBeTruthy()
  })

  it('shows the simulated finish for the saved minutes while the field is not a valid number', async () => {
    const { user } = setup()
    const dsa = region(DSA_TITLE)
    await user.clear(within(dsa).getByRole('spinbutton', { name: 'Số phút mỗi ngày' }))
    expect(within(dsa).getByText(/Với 60 phút\/ngày, lộ trình 8 tuần/)).toBeTruthy()
  })

  it('shows field errors under the fields and the message in an alert', async () => {
    const { user } = setup(
      {},
      {
        update: {
          ok: false,
          message: 'Kiểm tra lại các mục được đánh dấu.',
          fieldErrors: { budgetMinutes: 'Nhập số phút từ 10 đến 240, bước 5 phút.' },
        },
      },
    )
    const dsa = region(DSA_TITLE)
    await user.click(within(dsa).getByRole('button', { name: 'Lưu' }))
    await waitFor(() =>
      expect(
        within(dsa)
          .getAllByRole('alert')
          .map((alert) => alert.textContent),
      ).toContain('Kiểm tra lại các mục được đánh dấu.'),
    )
    const minutes = within(dsa).getByRole('spinbutton', { name: 'Số phút mỗi ngày' })
    expect(minutes.getAttribute('aria-invalid')).toBe('true')
    expect(within(dsa).getByText('Nhập số phút từ 10 đến 240, bước 5 phút.')).toBeTruthy()
  })

  it('takes the saved values when the page re-renders after a save', () => {
    const { view, updateTrack, setTrackStatus } = setup()
    const [dsa, ...rest] = TRACKS
    view.rerender(
      <TrackSettings
        tracks={[{ ...dsa!, enrollment: { ...dsa!.enrollment!, budgetMinutes: 90 } }, ...rest]}
        requestId="1f8d6a52-3b1c-4d7e-9a2f-6c5b4e3d2a10"
        updateTrack={updateTrack}
        setTrackStatus={setTrackStatus}
      />,
    )
    expect(
      within(region(DSA_TITLE)).getByRole('spinbutton', { name: 'Số phút mỗi ngày' }),
    ).toHaveProperty('value', '90')
  })
})

describe('TrackSettings — pause, resume, remove', () => {
  const actions = (title: string) =>
    within(region(title)).getByRole('group', { name: `Thao tác với ${title}` })

  it('offers "Tạm dừng" and "Gỡ lộ trình" for an active track, "Tiếp tục" and "Gỡ lộ trình" when paused', () => {
    setup()
    const names = (title: string) =>
      within(actions(title))
        .getAllByRole('button')
        .map((button) => button.textContent)
    expect(names(DSA_TITLE)).toEqual(['Tạm dừng', 'Gỡ lộ trình'])
    expect(names(ENGLISH_TITLE)).toEqual(['Tiếp tục', 'Gỡ lộ trình'])
  })

  it('"Tạm dừng" pauses at once and toasts', async () => {
    const { setTrackStatus, message, user } = setup()
    await user.click(within(actions(DSA_TITLE)).getByRole('button', { name: 'Tạm dừng' }))
    await waitFor(() => expect(setTrackStatus).toHaveBeenCalledTimes(1))
    expect(fields(setTrackStatus)).toEqual({ requestId: REQUEST_ID, trackId: 'dsa', to: 'paused' })
    expect(await screen.findByText(message)).toBeTruthy()
  })

  it('"Tiếp tục" resumes a paused track', async () => {
    const { setTrackStatus, user } = setup()
    await user.click(within(actions(ENGLISH_TITLE)).getByRole('button', { name: 'Tiếp tục' }))
    await waitFor(() => expect(setTrackStatus).toHaveBeenCalledTimes(1))
    expect(fields(setTrackStatus)).toEqual({
      requestId: REQUEST_ID,
      trackId: 'english',
      to: 'active',
    })
  })

  it('keeps focus on the pause button when it turns into "Tiếp tục"', async () => {
    const { view, updateTrack, setTrackStatus, user } = setup()
    const pause = within(actions(DSA_TITLE)).getByRole('button', { name: 'Tạm dừng' })
    await user.click(pause)
    await waitFor(() => expect(setTrackStatus).toHaveBeenCalledTimes(1))
    const [dsa, ...rest] = TRACKS
    view.rerender(
      <TrackSettings
        tracks={[{ ...dsa!, enrollment: { ...dsa!.enrollment!, status: 'paused' } }, ...rest]}
        requestId="1f8d6a52-3b1c-4d7e-9a2f-6c5b4e3d2a10"
        updateTrack={updateTrack}
        setTrackStatus={setTrackStatus}
      />,
    )
    const resume = within(actions(DSA_TITLE)).getByRole('button', { name: 'Tiếp tục' })
    expect(resume).toBe(pause)
    expect(document.activeElement).toBe(resume)
  })

  it('"Gỡ lộ trình" asks first, then removes', async () => {
    const { setTrackStatus, user } = setup()
    await user.click(within(actions(DSA_TITLE)).getByRole('button', { name: 'Gỡ lộ trình' }))
    const dialog = await screen.findByRole('alertdialog', { name: `Gỡ lộ trình ${DSA_TITLE}?` })
    expect(setTrackStatus).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Gỡ lộ trình' }))
    await waitFor(() => expect(setTrackStatus).toHaveBeenCalledTimes(1))
    expect(fields(setTrackStatus)).toEqual({ requestId: REQUEST_ID, trackId: 'dsa', to: 'removed' })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('"Huỷ" closes the dialog without removing', async () => {
    const { setTrackStatus, user } = setup()
    await user.click(within(actions(DSA_TITLE)).getByRole('button', { name: 'Gỡ lộ trình' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Huỷ' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(setTrackStatus).not.toHaveBeenCalled()
  })

  it('shows a failed status change in the track, not only as a toast', async () => {
    const { user } = setup(
      {},
      {
        status: { ok: false, message: 'Lộ trình đang ở trạng thái khác. Bạn tải lại trang nhé.' },
      },
    )
    await user.click(within(actions(DSA_TITLE)).getByRole('button', { name: 'Tạm dừng' }))
    await waitFor(() =>
      expect(
        within(region(DSA_TITLE))
          .getAllByRole('alert')
          .map((alert) => alert.textContent),
      ).toContain('Lộ trình đang ở trạng thái khác. Bạn tải lại trang nhé.'),
    )
  })

  it('keeps a status-change failure visible when the row itself disappears (M2 minor)', async () => {
    const message = 'Lộ trình đang ở trạng thái khác. Bạn tải lại trang nhé.'
    const { view, updateTrack, setTrackStatus, user } = setup(
      {},
      { status: { ok: false, message } },
    )
    await user.click(within(actions(DSA_TITLE)).getByRole('button', { name: 'Tạm dừng' }))
    await waitFor(() => expect(setTrackStatus).toHaveBeenCalledTimes(1))
    await screen.findByText(message)

    // A stale re-render (§4.1): the track is gone from the fresh data (someone else removed it
    // first) — the row itself is gone too, but the failure the learner has not read yet stays.
    const [, ...rest] = TRACKS
    view.rerender(
      <>
        <TrackSettings
          tracks={rest}
          requestId={REQUEST_ID}
          updateTrack={updateTrack}
          setTrackStatus={setTrackStatus}
        />
        <Toaster />
      </>,
    )
    expect(screen.queryByRole('region', { name: DSA_TITLE })).toBeNull()
    expect(screen.getByText(DSA_TITLE)).toBeTruthy()
    expect(screen.getByText(message)).toBeTruthy()
  })

  it('the orphaned failure is dismissible', async () => {
    const message = 'Lộ trình đang ở trạng thái khác. Bạn tải lại trang nhé.'
    const { view, updateTrack, setTrackStatus, user } = setup(
      {},
      { status: { ok: false, message } },
    )
    await user.click(within(actions(DSA_TITLE)).getByRole('button', { name: 'Tạm dừng' }))
    await waitFor(() => expect(setTrackStatus).toHaveBeenCalledTimes(1))
    await screen.findByText(message)
    const [, ...rest] = TRACKS
    view.rerender(
      <>
        <TrackSettings
          tracks={rest}
          requestId={REQUEST_ID}
          updateTrack={updateTrack}
          setTrackStatus={setTrackStatus}
        />
        <Toaster />
      </>,
    )
    await screen.findByText(message)
    await user.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(screen.queryByText(message)).toBeNull()
    expect(screen.queryByText(DSA_TITLE)).toBeNull()
  })
})
