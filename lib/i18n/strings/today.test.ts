import { describe, expect, it } from 'vitest'
import { fill } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { today } from './today'

function strings(node: unknown, path = 'today'): [string, string][] {
  if (typeof node === 'string') return [[path, node]]
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    strings(value, `${path}.${key}`),
  )
}

describe('lib/i18n/strings/today.ts', () => {
  it('is vi.today', () => {
    expect(vi.today).toBe(today)
  })

  it('stores every string non-empty, trimmed and in NFC (RF-3)', () => {
    for (const [path, value] of strings(today)) {
      expect(value, path).not.toBe('')
      expect(value, path).toBe(value.trim())
      expect(value, path).toBe(value.normalize('NFC'))
    }
  })

  it('drops the placeholder copy of decision 13 (the dashboard has landed)', () => {
    expect(Object.keys(today)).not.toContain('comingSoonTitle')
    expect(Object.keys(today)).not.toContain('comingSoonBody')
  })

  it('says the spec sentences word for word (§5.2, §5.5, DESIGN_SYSTEM §11, decision 32)', () => {
    expect(today.paused.title).toBe(
      'Lộ trình đang tạm dừng — hoàn thành ít nhất một phần để tiếp tục.',
    )
    expect(today.paused.resume).toBe('Học tiếp hôm nay')
    // UI I-5 (the M5-R33 rule): the plan's own count, in the past — never "Đang có".
    // M3: the count is the track's whole due queue (cards, exercises, prompts): "mục"; what is
    // reduced is the new items — "bài mới", as the "Học thêm" card and the block kind say.
    expect(fill(today.throttle.message, { n: 52 })).toBe(
      'Kế hoạch này được lập khi bạn có 52 mục cần ôn — tạm giảm bài mới.',
    )
    expect(today.resumed).toBe('Bạn đã tiếp tục lộ trình hôm nay — kế hoạch mới có vào ngày mai.')
    expect(fill(today.empty.notStarted.title, { date: '3 tháng 10, 2026' })).toBe(
      'Bắt đầu vào 3 tháng 10, 2026',
    )
    expect(today.empty.noBlocks.title).toBe('Hôm nay không có bài nào')
    expect(today.block.overBudget).toBe('Dài hơn thời gian dự kiến')
    // m-6: a weak topic counts items ("mục"), cards among them.
    expect(fill(today.weakAreas.count, { n: 3 })).toBe('3 mục yếu')
  })

  it('has one "page refreshed" message for every refused action that re-rendered /today (UI I-3)', () => {
    const refreshed = 'Kế hoạch vừa thay đổi. Trang đã được làm mới.'
    expect(vi.checkIn.errors.stale).toBe(refreshed)
    expect(vi.extra.add.stale).toBe(refreshed)
    expect(today.resumeResult.notOffered).toBe(refreshed)
    // The plan's three answers share one string; "Bắt đầu lại" has the track's own (M2).
    const all = [today, vi.checkIn, vi.extra].flatMap((area) => strings(area))
    expect(all.filter(([, value]) => value.includes('làm mới')).map(([, value]) => value)).toEqual([
      refreshed,
      refreshed,
      refreshed,
      vi.extra.reset.stale,
    ])
  })

  it('labels every block kind, and the practice tags of the default templates', () => {
    expect(today.kind).toEqual({
      review: 'Ôn tập',
      new: 'Bài mới',
      recap: 'Ôn tuần {week}',
      recapFiller: 'Ôn lại',
      practice: 'Luyện tập',
      extra: 'Học thêm',
    })
    expect(Object.keys(today.practice).sort()).toEqual(
      [
        'exercise',
        'mock-interview',
        'shadowing',
        'weekend-task',
        'topic-practice',
        'extra-week',
      ].sort(),
    )
    expect(today.practice['mock-interview']).toBe('Mock interview')
    // The AI override tags (task 6.6b/6.6c) read vi.overrides.blockTags, one label each.
    expect(today.practice['topic-practice']).toBe(vi.overrides.blockTags['topic-practice'])
    expect(today.practice['extra-week']).toBe(vi.overrides.blockTags['extra-week'])
  })
})
