import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Mode } from '@/lib/content/item-types'
import { ADMIN, pagePropsFor, promptItem, weeklyPromptItem } from '../fixtures'
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
    'shows the same minutes as its Row for the mode %s (context.mode)',
    (mode) => {
      const item = weeklyPromptItem()
      render(<PromptRow item={item} state={null} mode={mode} href="/x" />)
      const rowMeta = screen.getByRole('link').querySelector('[data-slot="link-row-meta"]')
      const rowMinutes = rowMeta?.textContent?.match(/\d+ phút/)?.[0]
      render(<PromptPage {...pagePropsFor(item, { context: { mode } })} />)
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
