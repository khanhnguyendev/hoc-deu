import { render, screen, within } from '@testing-library/react'
import type { MDXContent } from 'mdx/types'
import type { ComponentType, ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import type { CodeBundle } from '@/lib/content/code-tokens'
import { ADMIN, lessonItem, pagePropsFor } from '../fixtures'
import { LessonPage } from './Page'

/** MDX marks a fence's language on its `code` element (not a Tailwind class). */
const FENCE_CLASS = ['language', 'python'].join('-')

/** A stand-in lesson body: a bound `<Practice>` and a fenced block (the bound `pre`). */
const Body: MDXContent = ({ components }) => {
  const Practice = components?.Practice as ComponentType<{ problem: string }>
  const Pre = components?.pre as ComponentType<{ children: ReactNode }>
  return (
    <div data-testid="lesson-body">
      <Practice problem="dsa:lc-0015" />
      <Pre>
        <code className={FENCE_CLASS}>{'x = 1\n'}</code>
      </Pre>
    </div>
  )
}

const CODE: CodeBundle = { solutions: {}, blocks: {} }

describe('LessonPage', () => {
  it('shows the title as the h1, the format label and the topic', () => {
    render(<LessonPage {...pagePropsFor(lessonItem(), { data: { Body, code: CODE } })} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Two pointers' })).toBeTruthy()
    expect(screen.getByText('Pattern')).toBeTruthy()
    expect(screen.getByText('Two Pointers')).toBeTruthy()
  })

  it('labels a deep-dive, and shows an unknown format by its ID', () => {
    const { rerender } = render(
      <LessonPage {...pagePropsFor(lessonItem({ content: { format: 'deep-dive' } }))} />,
    )
    expect(screen.getByText('Deep-dive')).toBeTruthy()
    rerender(<LessonPage {...pagePropsFor(lessonItem({ content: { format: 'concept' } }))} />)
    expect(screen.getByText('concept')).toBeTruthy()
  })

  it('links the anchor and the practice problem through resolveItem', () => {
    render(<LessonPage {...pagePropsFor(lessonItem(), { data: { Body, code: CODE } })} />)
    const related = screen.getByRole('list', { name: 'Bài liên quan' })
    const anchor = within(related).getByRole('link', { name: /Bài mẫu/ })
    expect(anchor.getAttribute('href')).toBe('/t/dsa/items/lc-0167')
    expect(
      within(anchor).getByText('Two Sum II - Input Array Is Sorted').getAttribute('lang'),
    ).toBe('en')
    const practice = within(related).getByRole('link', { name: /Bài luyện tập/ })
    expect(practice.getAttribute('href')).toBe('/t/dsa/items/lc-0015')
  })

  it('skips links resolveItem does not know, and the list when none is left', () => {
    render(
      <LessonPage
        {...pagePropsFor(lessonItem(), { data: { Body, code: CODE }, resolveItem: () => null })}
      />,
    )
    expect(screen.queryByRole('list', { name: 'Bài liên quan' })).toBeNull()
  })

  it('renders the Body bound to its code and practice links', () => {
    render(<LessonPage {...pagePropsFor(lessonItem(), { data: { Body, code: CODE } })} />)
    const body = screen.getByTestId('lesson-body')
    expect(
      within(body)
        .getByRole('link', { name: /Bài luyện tập/ })
        .getAttribute('href'),
    ).toBe('/t/dsa/items/lc-0015')
    expect(within(body).getByRole('region', { name: 'Đoạn code Python' })).toBeTruthy()
  })

  it('an unloaded body reads as an empty state, not a crash', () => {
    render(<LessonPage {...pagePropsFor(lessonItem())} />)
    expect(screen.getByRole('heading', { name: 'Bài học chưa có nội dung' })).toBeTruthy()
  })

  it('a draft lesson starts with the draft notice', () => {
    const { container } = render(
      <LessonPage {...pagePropsFor(lessonItem({ status: 'draft' }), { viewer: ADMIN })} />,
    )
    const main = container.firstElementChild as HTMLElement
    expect(main.firstElementChild?.getAttribute('data-slot')).toBe('banner')
  })
})
