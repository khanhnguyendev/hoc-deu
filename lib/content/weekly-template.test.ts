import { describe, expect, it } from 'vitest'
import { vi } from '@/lib/i18n/vi'
import { describeThrottle, describeWeeklyTemplate } from './weekly-template'
import { WEEKDAY_KEYS, type TrackManifest, type WeeklyTemplate } from './schemas/manifest'

const dsaTemplate: WeeklyTemplate = {
  'mon-fri': [{ kind: 'review', maxMinutes: 15 }, { kind: 'new' }],
  sat: [{ kind: 'review' }],
  sun: [
    { kind: 'practice', tag: 'mock-interview', minutes: 45, fromWeek: 3 },
    { kind: 'recap', count: 3 },
  ],
}

const englishTemplate: WeeklyTemplate = {
  'mon-fri': [
    { kind: 'practice', itemType: 'exercise', minutes: 5 },
    { kind: 'practice', tag: 'shadowing', minutes: 3 },
    { kind: 'review' },
    { kind: 'new' },
  ],
  sat: [{ kind: 'review' }],
  sun: [{ kind: 'practice', tag: 'weekend-task', minutes: 15 }, { kind: 'review' }],
}

const dsaDefaults: TrackManifest['defaults'] = { budgetMinutes: 60, newPerDay: null, throttle: [] }
const englishDefaults: TrackManifest['defaults'] = {
  budgetMinutes: 25,
  newPerDay: 8,
  throttle: [
    { dueAbove: 40, newPerDay: 4 },
    { dueAbove: 60, newPerDay: 0 },
  ],
}

describe('describeWeeklyTemplate', () => {
  it('describes the DSA template in mon-fri, sat, sun order', () => {
    expect(describeWeeklyTemplate(dsaTemplate)).toEqual([
      { label: 'Thứ 2 – Thứ 6', blocks: ['Ôn tập (tối đa 15 phút)', 'Bài mới'] },
      { label: 'Thứ 7', blocks: ['Ôn tập'] },
      { label: 'Chủ nhật', blocks: ['Phỏng vấn thử · 45 phút (từ tuần 3)', 'Ôn lại 3 bài'] },
    ])
  })

  it('keeps the same day order when the YAML lists sun first', () => {
    const reordered: WeeklyTemplate = {
      sun: dsaTemplate.sun,
      'mon-fri': dsaTemplate['mon-fri'],
      sat: dsaTemplate.sat,
    }
    expect(describeWeeklyTemplate(reordered)).toEqual(describeWeeklyTemplate(dsaTemplate))
  })

  it('describes the English template', () => {
    const days = describeWeeklyTemplate(englishTemplate)
    expect(days.find((day) => day.label === 'Thứ 2 – Thứ 6')?.blocks).toEqual([
      'Bài tập · 5 phút',
      'Shadowing · 3 phút',
      'Ôn tập',
      'Bài mới',
    ])
    expect(days.find((day) => day.label === 'Chủ nhật')?.blocks).toEqual([
      'Nhiệm vụ cuối tuần · 15 phút',
      'Ôn tập',
    ])
  })

  it('prints the (từ tuần n) suffix on any block with fromWeek', () => {
    const template: WeeklyTemplate = {
      mon: [
        { kind: 'review', maxMinutes: 15, fromWeek: 2 },
        { kind: 'review', fromWeek: 3 },
        { kind: 'new', fromWeek: 4 },
        { kind: 'recap', count: 2, fromWeek: 5 },
        { kind: 'practice', itemType: 'prompt', minutes: 10, fromWeek: 6 },
      ],
    }
    expect(describeWeeklyTemplate(template)).toEqual([
      {
        label: 'Thứ 2',
        blocks: [
          'Ôn tập (tối đa 15 phút) (từ tuần 2)',
          'Ôn tập (từ tuần 3)',
          'Bài mới (từ tuần 4)',
          'Ôn lại 2 bài (từ tuần 5)',
          'prompt · 10 phút (từ tuần 6)',
        ],
      },
    ])
  })

  it('lists the days in the schema weekday order', () => {
    const template = Object.fromEntries(
      [...WEEKDAY_KEYS].reverse().map((day) => [day, [{ kind: 'new' }]]),
    ) as WeeklyTemplate
    expect(describeWeeklyTemplate(template).map((day) => day.label)).toEqual(
      WEEKDAY_KEYS.map((day) => vi.template.days[day]),
    )
  })
})

describe('describeThrottle', () => {
  it('returns three lines for English, the last pausing new cards', () => {
    const lines = describeThrottle(englishDefaults)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('Tối đa 8 thẻ mới mỗi ngày')
    expect(lines[1]).toBe('Trên 40 thẻ cần ôn: 4 thẻ mới mỗi ngày')
    expect(lines[2]).toBe('Trên 60 thẻ cần ôn: tạm dừng thẻ mới')
  })

  it('returns no lines for DSA (no newPerDay cap, no throttle rules)', () => {
    expect(describeThrottle(dsaDefaults)).toEqual([])
  })
})
