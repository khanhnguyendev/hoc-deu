import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Toaster } from '@/components/ui/toaster'
import type { SettingsAction, SettingsResult } from '../schema'
import { ScheduleForm } from './schedule-form'

const REQUEST_ID = '0f8d6a52-3b1c-4d7e-9a2f-6c5b4e3d2a10'
const TIME_ZONES = ['America/Los_Angeles', 'Asia/Ho_Chi_Minh', 'Asia/Tokyo'] as const
const VN = { timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '04:00' }
const PENDING = {
  timezone: 'America/Los_Angeles',
  dayStartsAt: '05:00',
  effectiveAt: '2026-09-24T21:00:00.000Z',
}
const NOTICE =
  'Thay đổi áp dụng từ 25 tháng 9, 2026 lúc 04:00 (giờ Asia/Ho_Chi_Minh) — ngày đang học không bị ảnh hưởng.'

// Sonner keeps its toasts in module state across tests, so every test toasts its own message.
let run = 0

function setup(
  props: Partial<React.ComponentProps<typeof ScheduleForm>> = {},
  result?: SettingsResult,
) {
  run += 1
  const message = `Đã lưu (${run}).`
  const updateSchedule = vi.fn<SettingsAction>(async () => result ?? { ok: true, message })
  const view = render(
    <>
      <ScheduleForm
        schedule={VN}
        pendingSchedule={null}
        timeZones={TIME_ZONES}
        requestId={REQUEST_ID}
        updateSchedule={updateSchedule}
        {...props}
      />
      <Toaster />
    </>,
  )
  return { updateSchedule, message, view, user: userEvent.setup() }
}

const zone = () => screen.getByRole('combobox', { name: 'Múi giờ' })
const dayStart = () => screen.getByRole('combobox', { name: 'Ngày mới bắt đầu lúc' })
const save = () => screen.getByRole('button', { name: 'Lưu lịch học' })
const sentFields = (action: ReturnType<typeof vi.fn<SettingsAction>>) =>
  Object.fromEntries(action.mock.calls[0]![1].entries())

describe('ScheduleForm — fields', () => {
  it('is a form named "Lịch học" with the labelled time zone and day start', () => {
    setup()
    expect(screen.getByRole('form', { name: 'Lịch học' })).toBeTruthy()
    expect(zone()).toHaveProperty('value', 'Asia/Ho_Chi_Minh')
    expect(dayStart()).toHaveProperty('value', '04:00')
    expect(screen.getAllByRole('option', { name: /^\d{2}:\d{2}$/ })).toHaveLength(25)
  })

  it('lists a saved zone the server list lacks, so the select never shows another zone', () => {
    setup({ schedule: { timezone: 'Europe/Kyiv', dayStartsAt: '04:00' } })
    expect(zone()).toHaveProperty('value', 'Europe/Kyiv')
  })

  it('shows no notice while no change is pending', () => {
    setup()
    expect(screen.queryByText(/Thay đổi áp dụng từ/)).toBeNull()
  })
})

describe('ScheduleForm — a pending change', () => {
  it('shows the pending values and when they take effect, in the zone in force', () => {
    setup({ pendingSchedule: PENDING })
    expect(zone()).toHaveProperty('value', 'America/Los_Angeles')
    expect(dayStart()).toHaveProperty('value', '05:00')
    expect(screen.getByText(NOTICE)).toBeTruthy()
  })

  it('takes the new values when the page re-renders after a save', () => {
    const { view, updateSchedule } = setup()
    view.rerender(
      <ScheduleForm
        schedule={VN}
        pendingSchedule={PENDING}
        timeZones={TIME_ZONES}
        requestId="1f8d6a52-3b1c-4d7e-9a2f-6c5b4e3d2a10"
        updateSchedule={updateSchedule}
      />,
    )
    expect(zone()).toHaveProperty('value', 'America/Los_Angeles')
    expect(screen.getByText(NOTICE)).toBeTruthy()
  })
})

describe('ScheduleForm — saving', () => {
  it('sends the requestId, time zone and day start, then toasts the result', async () => {
    const { updateSchedule, message, user } = setup()
    await user.selectOptions(zone(), 'Asia/Tokyo')
    await user.selectOptions(dayStart(), '06:30')
    await user.click(save())
    await waitFor(() => expect(updateSchedule).toHaveBeenCalledTimes(1))
    expect(sentFields(updateSchedule)).toEqual({
      requestId: REQUEST_ID,
      timezone: 'Asia/Tokyo',
      dayStartsAt: '06:30',
    })
    expect(await screen.findByText(message)).toBeTruthy()
  })

  it('shows field errors under the field and the message in an alert', async () => {
    const { user } = setup(
      {},
      {
        ok: false,
        message: 'Kiểm tra lại các mục được đánh dấu.',
        fieldErrors: { timezone: 'Múi giờ không hợp lệ.' },
      },
    )
    await user.click(save())
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Kiểm tra lại các mục được đánh dấu.',
      ),
    )
    expect(zone().getAttribute('aria-invalid')).toBe('true')
    expect(zone().getAttribute('aria-describedby')).toContain(
      screen.getByText('Múi giờ không hợp lệ.').closest('p')!.id,
    )
  })

  it('shows a failed save in the form, not only as a toast', async () => {
    const { user } = setup({}, { ok: false, message: 'Không lưu được thay đổi. Bạn thử lại nhé.' })
    await user.click(save())
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Không lưu được thay đổi. Bạn thử lại nhé.',
      ),
    )
  })
})
