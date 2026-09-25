import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentType } from 'react'
import { describe, expect, it } from 'vitest'
import { codeBlockKey, type CodeBundle } from '@/lib/content/code-tokens'
import { mdxComponentsFor, type MdxBindings, type PracticeTarget } from './bind'

const TARGET: PracticeTarget = {
  title: '3Sum',
  href: '/t/dsa/items/lc-0015',
  leetcode: 15,
  difficulty: 'M',
}

const CODE: CodeBundle = {
  solutions: { java: { lang: 'java', lines: [[['class', 'keyword'], ' Solution {}']] } },
  blocks: {
    [codeBlockKey('python', 'x = 1')]: { lang: 'python', lines: [['x = ', ['1', 'constant']]] },
  },
}

/** MDX marks a fence's language on its `code` element (not a Tailwind class). */
const PYTHON_FENCE = ['language', 'python'].join('-')

function bindings(overrides: Partial<MdxBindings> = {}): MdxBindings {
  return {
    code: CODE,
    codeLanguage: 'java',
    resolvePractice: (id) => (id === 'dsa:lc-0015' ? TARGET : null),
    ...overrides,
  }
}

/** The bound components, typed loosely: MDX passes them the attributes as props. */
function bound(overrides?: Partial<MdxBindings>) {
  return mdxComponentsFor(bindings(overrides)) as unknown as {
    Practice: ComponentType<{ problem: string }>
    Solution: ComponentType
    pre: ComponentType<{ children?: React.ReactNode }>
  }
}

describe('mdxComponentsFor', () => {
  it('binds Practice to the resolver: a known problem renders its card', () => {
    const { Practice } = bound()
    render(<Practice problem="dsa:lc-0015" />)
    expect(screen.getByRole('link').getAttribute('href')).toBe('/t/dsa/items/lc-0015')
  })

  it('renders nothing for a Practice ID the resolver does not know', () => {
    const { Practice } = bound()
    const { container } = render(<Practice problem="dsa:lc-9999" />)
    expect(container.innerHTML).toBe('')
  })

  it('binds Solution to the code bundle and the viewer’s language', async () => {
    const { Solution } = bound()
    render(<Solution />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Xem lời giải' }))
    expect(screen.getByRole('tab', { name: 'Java' }).getAttribute('aria-selected')).toBe('true')
  })

  it('renders nothing for Solution without code', () => {
    const { Solution } = bound({ code: null })
    const { container } = render(<Solution />)
    expect(container.innerHTML).toBe('')
  })

  it('binds pre to the bundle’s highlighted blocks', () => {
    const { pre: Pre } = bound()
    render(
      <Pre>
        <code className={PYTHON_FENCE}>{'x = 1\n'}</code>
      </Pre>,
    )
    expect(screen.getByRole('region').querySelector('.text-warning')?.textContent).toBe('1')
  })
})
