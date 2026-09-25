import { evaluate } from '@mdx-js/mdx'
import { render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import type { MDXContent } from 'mdx/types'
import * as runtime from 'react/jsx-runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mdxComponentsFor } from '@/features/items/mdx/bind'
import { mdxComponents } from '@/features/items/mdx/components'
import { remarkPlugins } from '@/tools/content/mdx/plugins'
import { SAMPLE_BINDINGS } from './fixtures'

/**
 * The /dev/content samples compiled like `@next/mdx` compiles them (the shared remark plugins) and
 * rendered with the global map plus the page's bindings — in React's development build, so a
 * missing key, an invalid nesting or a missing component fails here, not only in the browser.
 */
async function sample(name: 'lesson' | 'note'): Promise<MDXContent> {
  const source = readFileSync(`app/dev/content/sample-${name}.mdx`, 'utf8')
  return (await evaluate(source, { ...runtime, remarkPlugins })).default
}

const components = { ...mdxComponents, ...mdxComponentsFor(SAMPLE_BINDINGS) }
let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error')
})

afterEach(() => {
  expect(consoleError).not.toHaveBeenCalled()
  consoleError.mockRestore()
})

describe('/dev/content samples, rendered', () => {
  it('renders the lesson: its sections, highlighted code and the bound practice card', async () => {
    const Lesson = await sample('lesson')
    const { container } = render(<Lesson components={components} />)
    const kinds = [...container.querySelectorAll('[data-section]')].map((section) =>
      section.getAttribute('data-section'),
    )
    expect(kinds).toHaveLength(9)
    expect(container.textContent).not.toContain('format: pattern')
    const code = screen.getByRole('region', { name: 'Đoạn code Python' })
    expect(code.querySelector('.text-primary')?.textContent).toBe('def')
    expect(screen.getByRole('link', { name: /Bài luyện tập/ }).getAttribute('href')).toBe(
      '/t/dsa/items/lc-0015',
    )
    expect(within(container).getAllByRole('group')).not.toHaveLength(0)
  })

  it('renders the note: the solution toggle and the plain text fence', async () => {
    const Note = await sample('note')
    render(<Note components={components} />)
    expect(screen.getByRole('button', { name: 'Xem lời giải' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Đoạn văn bản', hidden: true }).textContent).toBe(
      '[3, 2, 4] -> [2, 3, 4]',
    )
    expect(screen.getByRole('region', { name: 'Bảng' })).toBeTruthy()
  })
})
