import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ADMIN, pagePropsFor, promptItem, weeklyPromptItem } from '../fixtures'
import { PromptPage } from './Page'

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
