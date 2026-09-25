import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MDXContent } from 'mdx/types'
import type { ComponentType } from 'react'
import { describe, expect, it } from 'vitest'
import type { CodeBundle } from '@/lib/content/code-tokens'
import { ADMIN, NOTE, pagePropsFor, premiumProblemItem, problemItem } from '../fixtures'
import { ProblemPage } from './Page'

/** A stand-in note body: prose, a bound `<Practice>` and the bound `<Solution />`. */
const Body: MDXContent = ({ components }) => {
  const Practice = components?.Practice as ComponentType<{ problem: string }>
  const Solution = components?.Solution as ComponentType
  return (
    <div data-testid="note-body">
      <p>Ý tưởng chính của bài.</p>
      <Practice problem="dsa:lc-0015" />
      <Solution />
    </div>
  )
}

const CODE: CodeBundle = {
  solutions: {
    python: { lang: 'python', lines: [['class Solution: ...']] },
    java: { lang: 'java', lines: [['class Solution {}']] },
  },
  blocks: {},
}

const noted = { Body, code: CODE }

describe('ProblemPage — header', () => {
  it('shows #leetcode, the English title as the h1, the difficulty and the topic', () => {
    render(<ProblemPage {...pagePropsFor(problemItem(), { data: noted })} />)
    const title = screen.getByRole('heading', { level: 1, name: 'Two Sum' })
    expect(within(title).getByText('Two Sum').closest('[lang]')?.getAttribute('lang')).toBe('en')
    expect(screen.getByText('#1')).toBeTruthy()
    expect(screen.getByText('Easy')).toBeTruthy()
    expect(screen.getByText('Arrays & Hashing')).toBeTruthy()
  })

  it('"Mở trên LeetCode" opens the problem in a new tab, safely', () => {
    render(<ProblemPage {...pagePropsFor(problemItem(), { data: noted })} />)
    const link = screen.getByRole('link', { name: /Mở trên LeetCode/ })
    expect(link.getAttribute('href')).toBe('https://leetcode.com/problems/two-sum/')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.className).toContain('h-11')
  })

  it('shows the verification badge when the note is visible', () => {
    render(<ProblemPage {...pagePropsFor(problemItem(), { data: noted })} />)
    expect(screen.getByText('Đã kiểm thử')).toBeTruthy()
  })

  it('shows "Chỉ biên dịch" for a compile-only note', () => {
    const item = problemItem({ content: { note: { ...NOTE, verification: 'compile-only' } } })
    render(<ProblemPage {...pagePropsFor(item, { data: noted })} />)
    expect(screen.getByText('Chỉ biên dịch')).toBeTruthy()
  })
})

describe('ProblemPage — premium', () => {
  it('marks a premium problem and links every free alternative', () => {
    const { container } = render(<ProblemPage {...pagePropsFor(premiumProblemItem())} />)
    expect(screen.getByText('Premium')).toBeTruthy()
    expect(container.querySelector('svg.lucide-lock')).not.toBeNull()
    const alternatives = screen.getByText('Bản miễn phí:').closest('div') as HTMLElement
    const link = within(alternatives).getByRole('link', { name: /LintCode 659 \(free\)/ })
    expect(link.getAttribute('href')).toBe('https://www.lintcode.com/problem/659/')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('a free problem has no premium marker', () => {
    render(<ProblemPage {...pagePropsFor(problemItem(), { data: noted })} />)
    expect(screen.queryByText('Premium')).toBeNull()
    expect(screen.queryByText('Bản miễn phí:')).toBeNull()
  })
})

describe('ProblemPage — the note', () => {
  it('renders the Body bound to the code, the viewer’s language and resolveItem', async () => {
    const user = userEvent.setup()
    const viewer = { codeLanguage: 'java' as const, isAdmin: false }
    render(<ProblemPage {...pagePropsFor(problemItem(), { data: noted, viewer })} />)
    expect(screen.getByTestId('note-body')).toBeTruthy()
    const practice = screen.getByRole('link', { name: /Bài luyện tập/ })
    expect(practice.getAttribute('href')).toBe('/t/dsa/items/lc-0015')
    await user.click(screen.getByRole('button', { name: 'Xem lời giải' }))
    expect(screen.getByRole('tab', { name: 'Java' }).getAttribute('aria-selected')).toBe('true')
  })

  it('no note: an inline "Chưa có ghi chú" empty state; you can still solve it on LeetCode', () => {
    render(<ProblemPage {...pagePropsFor(premiumProblemItem())} />)
    expect(screen.getByRole('heading', { name: 'Chưa có ghi chú' })).toBeTruthy()
    expect(screen.getByText('Bạn vẫn có thể giải bài trên LeetCode.')).toBeTruthy()
    expect(screen.queryByText('Đã kiểm thử')).toBeNull()
  })

  it('a draft note is hidden from a learner: "Chưa có ghi chú", no badge, no body', () => {
    const item = problemItem({ content: { note: { ...NOTE, status: 'draft' } } })
    render(<ProblemPage {...pagePropsFor(item, { data: noted })} />)
    expect(screen.getByRole('heading', { name: 'Chưa có ghi chú' })).toBeTruthy()
    expect(screen.queryByTestId('note-body')).toBeNull()
    expect(screen.queryByText('Đã kiểm thử')).toBeNull()
    expect(screen.queryByText('Bản nháp')).toBeNull()
  })

  it('a draft note renders for an admin, marked "Bản nháp"', () => {
    const item = problemItem({ content: { note: { ...NOTE, status: 'draft' } } })
    render(<ProblemPage {...pagePropsFor(item, { data: noted, viewer: ADMIN })} />)
    expect(screen.getByTestId('note-body')).toBeTruthy()
    expect(screen.getByText('Bản nháp')).toBeTruthy()
    expect(screen.getByText('Đã kiểm thử')).toBeTruthy()
  })

  it('a note whose MDX did not load reads as no note', () => {
    render(<ProblemPage {...pagePropsFor(problemItem())} />)
    expect(screen.getByRole('heading', { name: 'Chưa có ghi chú' })).toBeTruthy()
  })

  it('links the deep-dive lesson ("Bài học chuyên sâu") when the note has one', () => {
    const item = problemItem({ content: { note: { ...NOTE, deepDiveId: 'dsa:lesson-two-sum' } } })
    render(<ProblemPage {...pagePropsFor(item, { data: noted })} />)
    const link = screen.getByRole('link', { name: /Bài học chuyên sâu/ })
    expect(link.getAttribute('href')).toBe('/t/dsa/items/lesson-two-sum')
  })

  it('shows no deep-dive link when resolveItem does not know it', () => {
    const item = problemItem({ content: { note: { ...NOTE, deepDiveId: 'dsa:lesson-ghost' } } })
    render(<ProblemPage {...pagePropsFor(item, { data: noted })} />)
    expect(screen.queryByText('Bài học chuyên sâu')).toBeNull()
  })
})

describe('ProblemPage — status notice', () => {
  it('a draft problem starts with the draft notice; an active one has none', () => {
    const { container, rerender } = render(
      <ProblemPage {...pagePropsFor(problemItem({ status: 'draft' }), { viewer: ADMIN })} />,
    )
    const main = container.firstElementChild as HTMLElement
    expect(main.firstElementChild?.getAttribute('data-slot')).toBe('banner')
    rerender(<ProblemPage {...pagePropsFor(problemItem(), { data: noted })} />)
    expect(container.querySelector('[data-slot="banner"]')).toBeNull()
  })
})
