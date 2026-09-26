import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CoverageRow, RoadmapCoverage } from '../content'
import { ContentCoverage } from './content-coverage'

const row = (week: number, overrides: Partial<CoverageRow> = {}): CoverageRow => ({
  week,
  learners: 0,
  lessons: [{ topic: 'arrays', title: 'Mảng và băm', present: true }],
  notedProblems: 8,
  placedProblems: 8,
  coreCards: 0,
  extendedCards: 0,
  exercises: 0,
  prompts: 1,
  state: 'covered',
  ...overrides,
})
const missing = (week: number, state: 'red' | 'gap'): CoverageRow =>
  row(week, {
    lessons: [{ topic: 'linked-list', title: 'Danh sách liên kết', present: false }],
    notedProblems: 0,
    placedProblems: 10,
    state,
  })

const DSA: RoadmapCoverage = {
  trackTitle: 'Cấu trúc dữ liệu & Giải thuật',
  variant: '10w',
  variantLabel: '10 tuần',
  columns: ['lessons', 'notes', 'cards', 'prompts'],
  rows: [
    row(1),
    row(2),
    row(3, { learners: 1 }),
    missing(4, 'red'),
    missing(5, 'red'),
    missing(6, 'gap'),
  ],
  horizon: 5,
  maxLearnerWeek: 3,
}

const table = () =>
  within(
    screen.getByRole('region', {
      name: 'Độ phủ theo tuần của Cấu trúc dữ liệu & Giải thuật, 10 tuần',
    }),
  ).getByRole('table')
const bodyRows = () => within(table()).getAllByRole('row').slice(1)

describe('ContentCoverage', () => {
  it('titles the variant and names the horizon of the red warning', () => {
    render(<ContentCoverage coverage={DSA} />)
    expect(
      screen.getByRole('heading', { level: 3, name: 'Độ phủ theo tuần — 10 tuần' }),
    ).toBeTruthy()
    expect(
      screen.getByText(
        'Học viên có kế hoạch trong 14 ngày qua đang ở tới tuần 3: cảnh báo tính đến tuần 5.',
      ),
    ).toBeTruthy()
  })

  it('shows the columns of the listed types, one row per week', () => {
    render(<ContentCoverage coverage={DSA} />)
    const headers = within(table())
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent)
    expect(headers).toEqual([
      'Tuần',
      'Học viên',
      'Bài học',
      'Ghi chú (bài chính)',
      'Thẻ (core + extended)',
      'Prompt',
      'Tình trạng',
    ])
    expect(bodyRows()).toHaveLength(6)
    expect(
      within(bodyRows()[3]!)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['0', 'Danh sách liên kết (thiếu)', '0/10', '0 + 0', '1', 'Cần bổ sung'])
  })

  it('marks the red weeks with danger-soft, an icon and "Cần bổ sung" (never colour alone)', () => {
    render(<ContentCoverage coverage={DSA} />)
    const states = bodyRows().map((tr) => [
      tr.getAttribute('data-state'),
      tr.lastChild?.textContent,
    ])
    expect(states).toEqual([
      ['covered', 'Đủ'],
      ['covered', 'Đủ'],
      ['covered', 'Đủ'],
      ['red', 'Cần bổ sung'],
      ['red', 'Cần bổ sung'],
      ['gap', 'Còn thiếu'],
    ])
    const red = bodyRows()[3]!
    expect(red.className).toContain('bg-danger-soft')
    expect(red.querySelector('svg')).toBeTruthy()
    expect(bodyRows()[5]!.className).not.toContain('bg-danger-soft')
  })

  it('shows English item-type headers in English (lang="en")', () => {
    render(
      <ContentCoverage
        coverage={{
          ...DSA,
          trackTitle: 'Tiếng Anh cho môi trường IT',
          columns: ['cards', 'exercises', 'prompts'],
          rows: [row(1, { coreCards: 12, extendedCards: 18, exercises: 6, lessons: [] })],
        }}
      />,
    )
    const exercise = screen.getByRole('columnheader', { name: 'Exercise' })
    expect(exercise.getAttribute('lang')).toBe('en')
    expect(screen.queryByRole('columnheader', { name: 'Bài học' })).toBeNull()
  })

  it('says so when no learner has a recent plan (no red row)', () => {
    render(
      <ContentCoverage
        coverage={{
          ...DSA,
          rows: DSA.rows!.map((r) => (r.state === 'red' ? { ...r, state: 'gap' } : r)),
          horizon: null,
          maxLearnerWeek: null,
        }}
      />,
    )
    expect(
      screen.getByText(
        'Chưa học viên nào có kế hoạch trong 14 ngày qua: chưa có tuần nào cần cảnh báo.',
      ),
    ).toBeTruthy()
    expect(bodyRows().filter((tr) => tr.getAttribute('data-state') === 'red')).toEqual([])
  })

  it('says so for a variant without its roadmap file, with no table', () => {
    render(
      <ContentCoverage
        coverage={{
          ...DSA,
          variant: '8w',
          variantLabel: '8 tuần',
          rows: null,
          horizon: null,
          maxLearnerWeek: null,
        }}
      />,
    )
    expect(screen.getByText('Chưa có tệp lộ trình cho biến thể này.')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })
})
