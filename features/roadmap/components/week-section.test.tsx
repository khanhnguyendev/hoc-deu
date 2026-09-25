import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DeckSummary } from '@/lib/content/catalog-types'
import type { WeekSlots } from '../slots'
import { WeekSection } from './week-section'

const row = (title: string) => <a href={`/items/${title}`}>{title}</a>

const DECK: DeckSummary = {
  id: 'english:deck-w01-standup',
  trackId: 'english',
  kind: 'vocabulary',
  week: 1,
  topicId: 'standup',
  title: { vi: 'Họp stand-up', en: 'Stand-up meetings' },
  status: 'active',
  cardIds: [],
}

const EMPTY: WeekSlots = {
  week: 3,
  topics: [{ id: 'stack', title: 'Stack' }],
  lessons: [],
  core: [],
  recap: [],
  bonus: [],
  decks: [],
  exercises: [],
  prompts: [],
}

const FULL: WeekSlots = {
  week: 1,
  topics: [
    { id: 'arrays-hashing', title: 'Arrays & Hashing' },
    { id: 'two-pointers', title: 'Two Pointers' },
  ],
  lessons: [row('Two pointers')],
  core: [row('Two Sum'), row('Two Sum II')],
  recap: [
    { row: row('Encode and Decode Strings'), mode: null },
    { row: row('Two Sum (recall)'), mode: 'recall' },
    { row: row('Two Sum II (redo)'), mode: 'redo' },
    { row: row('Contains Duplicate'), mode: 'explain-aloud' },
  ],
  bonus: [row('3Sum')],
  decks: [{ deck: DECK, core: [row('blocker'), row('ETA')], extended: [row('heads-up')] }],
  exercises: [row('Điền từ còn thiếu')],
  prompts: [row('Ghi âm cập nhật stand-up')],
}

const week = (n: number) => screen.getByRole('region', { name: `Tuần ${n}` })

describe('WeekSection', () => {
  it('is a region named "Tuần {n}" with its topics as chips', () => {
    render(<WeekSection week={FULL} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Tuần 1' })).toBeTruthy()
    const topics = within(week(1)).getByRole('list', { name: 'Chủ đề' })
    expect(
      within(topics)
        .getAllByRole('listitem')
        .map((chip) => chip.textContent),
    ).toEqual(['Arrays & Hashing', 'Two Pointers'])
  })

  it('labels each group in order: lessons, core, recap, bonus, decks, exercises, prompts', () => {
    render(<WeekSection week={FULL} />)
    const headings = within(week(1))
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(headings).toEqual([
      'Bài học',
      'Bài chính',
      'Ôn lại cuối tuần',
      'Bài thêm',
      'Bộ thẻ',
      'Bài tập',
      'Nhiệm vụ',
    ])
    expect(within(week(1)).getByRole('link', { name: 'Two Sum' })).toBeTruthy()
    expect(within(week(1)).getByRole('link', { name: '3Sum' })).toBeTruthy()
  })

  it('labels the recap modes; an entry without a mode has no label', () => {
    render(<WeekSection week={FULL} />)
    const recap = within(week(1)).getByRole('list', { name: 'Ôn lại cuối tuần' })
    const items = within(recap).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      'Encode and Decode Strings',
      'Nhớ lại Two Sum (recall)',
      'Làm lại Two Sum II (redo)',
      'Giải thích thành lời Contains Duplicate',
    ])
  })

  it('shows a deck’s title, its card counts and its cards in a disclosure', () => {
    const { container } = render(<WeekSection week={FULL} />)
    expect(within(week(1)).getByRole('heading', { level: 4, name: 'Họp stand-up' })).toBeTruthy()
    expect(within(week(1)).getByText('2 thẻ cốt lõi · 1 thẻ mở rộng')).toBeTruthy()
    const details = container.querySelector('details')
    expect(details?.querySelector('summary')?.textContent).toBe('Xem các thẻ')
    expect([...(details?.querySelectorAll('li') ?? [])].map((item) => item.textContent)).toEqual([
      'blocker',
      'ETA',
      'heads-up',
    ])
  })

  it('leaves out empty groups', () => {
    render(<WeekSection week={{ ...EMPTY, week: 2, core: [row('Two Sum')] }} />)
    const headings = within(week(2))
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(headings).toEqual(['Bài chính'])
  })

  it('[RF-4] says a week has nothing yet (e.g. every item is a draft) instead of rendering blank', () => {
    render(<WeekSection week={EMPTY} />)
    expect(within(week(3)).getByText('Tuần này chưa có nội dung.')).toBeTruthy()
    expect(within(week(3)).queryAllByRole('heading', { level: 3 })).toEqual([])
    expect(within(week(3)).getByRole('list', { name: 'Chủ đề' })).toBeTruthy()
  })
})
