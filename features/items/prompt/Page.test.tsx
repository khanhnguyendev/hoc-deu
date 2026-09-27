import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Mode } from '@/lib/content/item-types'
import {
  ADMIN,
  FIXTURE_LINKS,
  outcomeBinding,
  pagePropsFor,
  promptItem,
  SAVED,
  weeklyPromptItem,
} from '../fixtures'
import type { RecordOutcome } from '../outcome'
import { PromptPage } from './Page'
import { PromptRow } from './Row'

describe('PromptPage', () => {
  it('shows the instruction (vi h1, en in lang="en"), minutes, tag and rubric', () => {
    render(<PromptPage {...pagePropsFor(promptItem())} />)
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Phỏng vấn thử: giải một bài trong 30 phút và nói to cách làm',
      }),
    ).toBeTruthy()
    expect(screen.getByText(/^Mock interview:/).getAttribute('lang')).toBe('en')
    expect(screen.getByText('45 phút')).toBeTruthy()
    expect(screen.getByText('Phỏng vấn thử')).toBeTruthy()
    const rubric = screen.getByRole('list', { name: 'Tiêu chí' })
    expect(within(rubric).getAllByRole('listitem')).toHaveLength(2)
  })

  it('a prompt without its own length takes the manifest estimate; the tag label from vi', () => {
    render(<PromptPage {...pagePropsFor(weeklyPromptItem())} />)
    expect(screen.getByText('10 phút')).toBeTruthy()
    expect(screen.getByText('Nhiệm vụ cuối tuần')).toBeTruthy()
  })

  it('marks an English rubric lang="en"; a Vietnamese one (the default) keeps the page language', () => {
    const { rerender } = render(
      <PromptPage {...pagePropsFor(weeklyPromptItem({ content: { lang: { rubric: 'en' } } }))} />,
    )
    expect(screen.getByRole('list', { name: 'Tiêu chí' }).getAttribute('lang')).toBe('en')
    rerender(<PromptPage {...pagePropsFor(promptItem())} />)
    expect(screen.getByRole('list', { name: 'Tiêu chí' }).hasAttribute('lang')).toBe(false)
  })

  it.each<Mode>(['new', 'review', 'redo'])(
    'shows the same minutes as its Row for the mode %s (the binding’s mode)',
    (mode) => {
      const item = weeklyPromptItem()
      render(<PromptRow item={item} state={null} mode={mode} href="/x" />)
      const rowMeta = screen.getByRole('link').querySelector('[data-slot="link-row-meta"]')
      const rowMinutes = rowMeta?.textContent?.match(/\d+ phút/)?.[0]
      render(<PromptPage {...pagePropsFor(item, { outcome: outcomeBinding(vi.fn(), { mode }) })} />)
      const facts = document.querySelector('[data-slot="item-meta"]')
      expect(rowMinutes).toBe('10 phút')
      expect(facts?.textContent).toContain(rowMinutes)
    },
  )

  it('an unknown tag shows its ID; an empty rubric shows no list', () => {
    render(
      <PromptPage {...pagePropsFor(promptItem({ content: { tag: 'pair-review', rubric: [] } }))} />,
    )
    expect(screen.getByText('pair-review')).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Tiêu chí' })).toBeNull()
  })

  it('a draft prompt starts with the draft notice', () => {
    const { container } = render(
      <PromptPage {...pagePropsFor(promptItem({ status: 'draft' }), { viewer: ADMIN })} />,
    )
    const main = container.firstElementChild as HTMLElement
    expect(main.firstElementChild?.getAttribute('data-slot')).toBe('banner')
  })
})

describe('PromptPage — results and the mock interview (task 5.2c)', () => {
  it('no "Đã làm xong" without a binding', () => {
    render(<PromptPage {...pagePropsFor(weeklyPromptItem())} />)
    expect(screen.queryByRole('button', { name: 'Đã làm xong' })).toBeNull()
  })

  it('with a binding: "Đã làm xong" with an optional rating sends prompt.completed', async () => {
    const user = userEvent.setup()
    const record = vi.fn<RecordOutcome>(async () => SAVED)
    const item = weeklyPromptItem()
    render(
      <PromptPage
        {...pagePropsFor(item, { outcome: outcomeBinding(record, { itemId: item.id }) })}
      />,
    )
    await user.click(screen.getByRole('radio', { name: '3 — Tốt' }))
    await user.click(screen.getByRole('button', { name: 'Đã làm xong' }))
    expect(record.mock.calls[0]![0]).toMatchObject({
      itemId: item.id,
      outcome: { type: 'prompt.completed', selfRating: 3 },
    })
  })

  it('the mock-interview prompt links the problem mockInterviewProblem picks', () => {
    const problem = FIXTURE_LINKS['dsa:lc-0015']!
    render(<PromptPage {...pagePropsFor(promptItem(), { mockInterviewProblem: problem })} />)
    const link = screen.getByRole('link', { name: /3Sum/ })
    expect(link.getAttribute('href')).toBe('/t/dsa/items/lc-0015')
    expect(link.textContent).toContain('Bài cho buổi phỏng vấn thử')
  })

  it('…or says "Chưa có bài Medium nào đã học" when it picks none', () => {
    render(<PromptPage {...pagePropsFor(promptItem(), { mockInterviewProblem: null })} />)
    expect(screen.getByRole('heading', { name: 'Chưa có bài Medium nào đã học' })).toBeTruthy()
  })

  it('any other prompt shows neither', () => {
    render(<PromptPage {...pagePropsFor(weeklyPromptItem())} />)
    expect(screen.queryByText('Bài cho buổi phỏng vấn thử')).toBeNull()
    expect(screen.queryByText('Chưa có bài Medium nào đã học')).toBeNull()
  })
})
