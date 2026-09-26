import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TodayState } from '@/lib/plans/today'
import {
  block,
  blockView,
  DSA_TITLE,
  ENGLISH_TITLE,
  OLD_PLAN_ID,
  PLAN_ID,
  storedPlan,
  TODAY,
  todayPage,
  trackView,
} from '../__tests__/fixtures'
import type { TodaySlots } from '../slots'
import { TodayView } from './today-view'

vi.mock('@/components/ui/toaster', () => ({ toast: () => {} }))

const markPlanSeen = vi.fn<(planId: string) => Promise<void>>(async () => {})
const resumeToday = vi.fn(async () => ({ ok: true, message: '' }))

beforeEach(() => {
  markPlanSeen.mockClear()
  resumeToday.mockClear()
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
        weakTopics: [{ trackId: 'dsa', title: 'Two Pointers', trackTitle: DSA_TITLE, count: 2 }],
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

  it('unreadable: the error state', () => {
    view({ kind: 'unreadable' })
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Không đọc được kế hoạch hôm nay')
    expect(screen.queryByRole('article')).toBeNull()
  })
})
