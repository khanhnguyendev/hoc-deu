import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CheckInInput, CheckInResult } from '@/features/checkin'
import type { TodayState } from '@/lib/plans/today'
import {
  block,
  blockState,
  blockView,
  DSA_TITLE,
  ENGLISH_TITLE,
  OLD_PLAN_ID,
  PLAN_ID,
  REQUEST_ID,
  storedPlan,
  TODAY,
  todayPage,
  trackView,
} from '../__tests__/fixtures'
import type { TodaySlots } from '../slots'
import { TodayView } from './today-view'

vi.mock('@/components/ui/toaster', () => ({ toast: () => {} }))
const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

const markPlanSeen = vi.fn<(planId: string) => Promise<void>>(async () => {})
const resumeToday = vi.fn(async () => ({ ok: true, message: '' }))
const checkIn = vi.fn<(input: CheckInInput) => Promise<CheckInResult>>(async () => ({
  ok: true,
  message: 'Đã check-in: xong khối học.',
}))

beforeEach(() => {
  markPlanSeen.mockClear()
  resumeToday.mockClear()
  checkIn.mockClear()
  router.replace.mockClear()
  router.refresh.mockClear()
})

const YESTERDAY = '2026-09-27'
const NEW_BLOCK = `${TODAY}:dsa:new:1`
const ENGLISH_BLOCK = `${TODAY}:english:review:1`
const plan = storedPlan()

const blocks = [
  blockView({ block: block(NEW_BLOCK, { kind: 'new', trackId: 'dsa', estMinutes: 35 }) }),
  blockView({
    block: block(ENGLISH_BLOCK, { kind: 'review', trackId: 'english', estMinutes: 5 }),
    trackTitle: ENGLISH_TITLE,
    accent: 'track-2',
    kindLabel: 'Ôn tập',
  }),
]
const slots: TodaySlots = {
  [NEW_BLOCK]: {
    items: [{ itemId: 'dsa:lc-0002', row: <a href="/r">Add Two Numbers</a>, noNote: true }],
    sentences: [],
  },
}

function view(state: TodayState, change: Parameters<typeof todayPage>[1] = {}) {
  return render(
    <TodayView
      page={todayPage(state, change)}
      slots={slots}
      markPlanSeen={markPlanSeen}
      resumeToday={resumeToday}
      checkIn={checkIn}
    />,
  )
}

describe('TodayView (§2.4, DESIGN_SYSTEM §5 dashboard order)', () => {
  it('plan: the h1 and date, the plan’s blocks, stats and weak areas; marks the plan seen', () => {
    view(
      { kind: 'plan', plan, blocks: {} },
      {
        blocks,
        tracks: [trackView()],
        streak: 4,
        weakTopics: [
          {
            trackId: 'dsa',
            topicId: 'two-pointers',
            title: 'Two Pointers',
            trackTitle: DSA_TITLE,
            count: 2,
          },
        ],
        markSeenPlanId: PLAN_ID,
      },
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Hôm nay' })).toBeTruthy()
    expect(screen.getByText('Thứ Hai, 28 tháng 9, 2026')).toBeTruthy()
    const section = screen.getByRole('region', { name: 'Kế hoạch hôm nay' })
    expect(section.textContent).toContain('2 khối · 40 phút')
    expect(
      within(section)
        .getAllByRole('article')
        .map((card) => card.getAttribute('aria-labelledby')),
    ).toHaveLength(2)
    expect(within(section).getByRole('article', { name: `Bài mới ${DSA_TITLE}` })).toBeTruthy()
    expect(within(section).getByRole('article', { name: `Ôn tập ${ENGLISH_TITLE}` })).toBeTruthy()
    expect(within(section).getByText('Chưa có ghi chú')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Tiến độ' }).textContent).toContain(
      '4 ngày liên tiếp',
    )
    expect(screen.getByRole('region', { name: 'Chủ đề cần củng cố' })).toBeTruthy()
    expect(markPlanSeen.mock.calls).toEqual([[PLAN_ID]])
    // Decision 12: no mode badge in v1.0.
    expect(document.body.textContent).not.toMatch(/AI/)
  })

  it('an empty plan: "Hôm nay không có bài nào", still marked seen', () => {
    view({ kind: 'plan', plan, blocks: {} }, { markSeenPlanId: PLAN_ID })
    expect(screen.getByRole('heading', { name: 'Hôm nay không có bài nào' })).toBeTruthy()
    expect(screen.queryByRole('article')).toBeNull()
    expect(markPlanSeen).toHaveBeenCalledTimes(1)
  })

  it('shows the throttle notices first', () => {
    view(
      { kind: 'plan', plan, blocks: {} },
      {
        blocks,
        tracks: [
          trackView(),
          trackView({
            trackId: 'english',
            title: ENGLISH_TITLE,
            throttleMessage: 'Đang có 52 thẻ cần ôn — tạm giảm thẻ mới.',
          }),
        ],
      },
    )
    const text = document.body.textContent ?? ''
    expect(text).toContain('Đang có 52 thẻ cần ôn — tạm giảm thẻ mới.')
    expect(text.indexOf('tạm giảm thẻ mới')).toBeLessThan(text.indexOf('Kế hoạch hôm nay'))
  })

  it('resumed: the resumed header and the resumed plan of its date; nothing marked', () => {
    const old = storedPlan({ id: OLD_PLAN_ID, planDate: YESTERDAY })
    view({ kind: 'resumed', plan: old, blocks: {} }, { blocks })
    expect(
      screen.getByText('Bạn đã tiếp tục lộ trình hôm nay — kế hoạch mới có vào ngày mai.'),
    ).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Kế hoạch ngày 27 tháng 9, 2026' })).toBeTruthy()
    expect(markPlanSeen).not.toHaveBeenCalled()
  })

  it('paused: the banner with the plan’s date and "Học tiếp hôm nay" above the unfinished blocks', () => {
    const old = storedPlan({ id: OLD_PLAN_ID, planDate: '2026-09-25' })
    view(
      {
        kind: 'paused',
        plan: old,
        unfinished: [],
        blocks: {},
        daysSince: 3,
        offerResume: true,
      },
      { blocks: blocks.slice(0, 1) },
    )
    const text = document.body.textContent ?? ''
    expect(text).toContain('Lộ trình đang tạm dừng — hoàn thành ít nhất một phần để tiếp tục.')
    expect(text).toContain('Kế hoạch ngày 25 tháng 9, 2026')
    expect(screen.getByRole('button', { name: 'Học tiếp hôm nay' })).toBeTruthy()
    const section = screen.getByRole('region', { name: 'Phần còn dang dở' })
    expect(within(section).getAllByRole('article')).toHaveLength(1)
    expect(text.indexOf('tạm dừng')).toBeLessThan(text.indexOf('Phần còn dang dở'))
    expect(markPlanSeen).not.toHaveBeenCalled()
  })

  it('paused within 2 days: no resume button', () => {
    const old = storedPlan({ id: OLD_PLAN_ID, planDate: '2026-09-26' })
    view(
      { kind: 'paused', plan: old, unfinished: [], blocks: {}, daysSince: 2, offerResume: false },
      { blocks: blocks.slice(0, 1) },
    )
    expect(screen.queryByRole('button', { name: 'Học tiếp hôm nay' })).toBeNull()
  })

  it('not started: "Bắt đầu vào {date}" only', () => {
    view({ kind: 'notStarted', startDate: '2026-10-03' }, { tracks: [trackView()] })
    expect(screen.getByRole('heading', { name: 'Bắt đầu vào 3 tháng 10, 2026' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Tiến độ' })).toBeNull()
    expect(markPlanSeen).not.toHaveBeenCalled()
  })

  it('no tracks: the empty state with a link to /settings', () => {
    view({ kind: 'noTracks' })
    expect(screen.getByRole('link', { name: 'Mở Cài đặt' }).getAttribute('href')).toBe('/settings')
  })

  it('unreadable: the error state with "Thử lại", which renders the page again (M5-R26)', async () => {
    const user = userEvent.setup()
    view({ kind: 'unreadable' })
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Không đọc được kế hoạch hôm nay')
    // It never promises that the plan repairs itself.
    expect(alert.textContent).not.toMatch(/sau ít phút/)
    expect(screen.queryByRole('article')).toBeNull()
    await user.click(within(alert).getByRole('button', { name: 'Thử lại' }))
    expect(router.refresh).toHaveBeenCalledTimes(1)
  })
})

describe('TodayView — check-in (5.2b)', () => {
  const checked = blockState(PLAN_ID, NEW_BLOCK, { status: 'done', minutes: 35 })

  it('a block without a check-in has the one-tap button; a checked-in one its status and "Sửa"', () => {
    view(
      { kind: 'plan', plan, blocks: {} },
      { blocks: [{ ...blocks[0]!, checkIn: checked }, blocks[1]!] },
    )
    const dsa = screen.getByRole('article', { name: `Bài mới ${DSA_TITLE}` })
    expect(within(dsa).queryByRole('button', { name: /^Check-in/ })).toBeNull()
    expect(within(dsa).getByRole('link', { name: `Sửa Bài mới · ${DSA_TITLE}` })).toBeTruthy()
    const english = screen.getByRole('article', { name: `Ôn tập ${ENGLISH_TITLE}` })
    expect(
      within(english).getByRole('button', { name: `Check-in: Ôn tập · ${ENGLISH_TITLE}` }),
    ).toBeTruthy()
  })

  it('the one-tap checks in the block of the plan shown, with the page’s request id', () => {
    view({ kind: 'plan', plan, blocks: {} }, { blocks })
    fireEvent.click(screen.getByRole('button', { name: `Check-in: Bài mới · ${DSA_TITLE}` }))
    expect(checkIn.mock.calls).toEqual([
      [{ requestId: REQUEST_ID, planId: PLAN_ID, blockId: NEW_BLOCK, status: 'done' }],
    ])
  })

  it('the paused view checks in the paused plan; a skipped block says to tap "Sửa" (M-6 a)', () => {
    const old = storedPlan({ id: OLD_PLAN_ID, planDate: YESTERDAY })
    const skipped = blockState(OLD_PLAN_ID, NEW_BLOCK, { status: 'skipped', minutes: 0 })
    view(
      {
        kind: 'paused',
        plan: old,
        unfinished: [],
        blocks: {},
        daysSince: 1,
        offerResume: false,
      },
      { blocks: [{ ...blocks[0]!, checkIn: skipped }, blocks[1]!] },
    )
    expect(screen.getByText('Đã bỏ qua — bấm Sửa khi bạn làm xong')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: `Check-in: Ôn tập · ${ENGLISH_TITLE}` }))
    expect(checkIn.mock.calls[0]![0]).toMatchObject({ planId: OLD_PLAN_ID, blockId: ENGLISH_BLOCK })
  })

  it('?block= opens the check-in sheet for that block, pre-filled with its check-in', () => {
    view(
      { kind: 'plan', plan, blocks: {} },
      {
        blocks: [{ ...blocks[0]!, checkIn: { ...checked, status: 'partial', note: 'Còn bài 2' } }],
        openBlockId: NEW_BLOCK,
      },
    )
    const sheet = screen.getByRole('dialog', { name: 'Check-in: Bài mới' })
    expect(sheet.textContent).toContain(`${DSA_TITLE} · dự kiến 35 phút`)
    expect(
      within(sheet).getByRole('radio', { name: 'Một phần' }).getAttribute('aria-checked'),
    ).toBe('true')
    expect(within(sheet).getByRole('spinbutton')).toHaveProperty('value', '35')
    expect(within(sheet).getByRole('textbox')).toHaveProperty('value', 'Còn bài 2')
  })

  it('no ?block= (or an unknown one, which the view model drops): no sheet', () => {
    view({ kind: 'plan', plan, blocks: {} }, { blocks })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
