import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DeckSummary } from '@/lib/content/catalog-types'
import type { RoadmapSlots, WeekSlots } from '../slots'
import { RoadmapView } from './roadmap-view'

const row = (title: string) => <a href={`/items/${title}`}>{title}</a>

const week = (n: number, core: string[]): WeekSlots => ({
  week: n,
  topics: [{ id: `topic-${n}`, title: `Chủ đề ${n}` }],
  lessons: [],
  core: core.map(row),
  recap: [],
  bonus: [],
  decks: [],
  exercises: [],
  prompts: [],
})

const DERIVED: DeckSummary = {
  id: 'english:explaining-code',
  trackId: 'english',
  kind: 'derived',
  week: null,
  topicId: null,
  title: { vi: 'Giải thích code', en: 'Explaining code' },
  status: 'active',
  cardIds: ['english:explaining-code:dsa:lc-0001'],
}

const SLOTS: RoadmapSlots = {
  variant: '8w',
  weeks: [week(1, ['Two Sum']), week(2, ['Valid Anagram'])],
  anytime: { prompts: [row('Phỏng vấn thử')], derivedDecks: [{ deck: DERIVED, unlocked: 12 }] },
}

describe('RoadmapView', () => {
  it('renders one section per week, in order', () => {
    render(<RoadmapView slots={SLOTS} />)
    const weeks = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    expect(weeks).toEqual(['Tuần 1', 'Tuần 2', 'Không theo tuần'])
    expect(
      within(screen.getByRole('region', { name: 'Tuần 2' })).getByRole('link', {
        name: 'Valid Anagram',
      }),
    ).toBeTruthy()
  })

  it('ends with "Không theo tuần": repeatable prompts and derived decks with their card count', () => {
    render(<RoadmapView slots={SLOTS} />)
    const anytime = screen.getByRole('region', { name: 'Không theo tuần' })
    expect(within(anytime).getByRole('heading', { level: 3, name: 'Nhiệm vụ' })).toBeTruthy()
    expect(within(anytime).getByRole('link', { name: 'Phỏng vấn thử' })).toBeTruthy()
    expect(within(anytime).getByRole('heading', { level: 3, name: 'Bộ thẻ' })).toBeTruthy()
    expect(within(anytime).getByRole('heading', { level: 4, name: 'Giải thích code' })).toBeTruthy()
    expect(within(anytime).getByText('12 thẻ')).toBeTruthy()
    expect(within(anytime).getByText('Mỗi thẻ mở sau khi bạn làm bài gốc.')).toBeTruthy()
  })

  it('leaves out "Không theo tuần" when it would be empty', () => {
    render(<RoadmapView slots={{ ...SLOTS, anytime: { prompts: [], derivedDecks: [] } }} />)
    expect(screen.queryByRole('region', { name: 'Không theo tuần' })).toBeNull()
  })
})
