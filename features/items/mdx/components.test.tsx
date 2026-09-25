import { render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import { describe, expect, it } from 'vitest'
import { MDX_COMPONENT_NAMES } from '@/lib/content/mdx-components'
import { ContentImage } from '../components/mdx/content-image'
import { ExternalLink } from '../components/mdx/external-link'
import { mdxComponents } from './components'

const MARKDOWN = [
  'h2',
  'h3',
  'h4',
  'p',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'blockquote',
  'code',
  'pre',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'hr',
  'strong',
  'em',
  'input',
] as const

/** The class GFM puts on a task list's `ul` (MDX output, not a Tailwind class). */
const TASK_LIST = ['contains', 'task', 'list'].join('-')

const lookup = mdxComponents as unknown as Record<string, ComponentType<Record<string, unknown>>>

describe('mdxComponents', () => {
  it('provides every allow-listed component (MDX throws on an undefined one)', () => {
    for (const name of MDX_COMPONENT_NAMES) expect(lookup[name], name).toBeTypeOf('function')
  })

  it('overrides the Markdown elements content uses', () => {
    for (const name of MARKDOWN) expect(lookup[name], name).toBeTypeOf('function')
  })

  it.each(['Solution', 'Practice'])('renders %s as nothing until a page binds it', (name) => {
    const Component = lookup[name]!
    const { container } = render(<Component problem="dsa:lc-0015" />)
    expect(container.innerHTML).toBe('')
  })

  it('routes links through ExternalLink and images through ContentImage', () => {
    expect(mdxComponents.a).toBe(ExternalLink)
    expect(mdxComponents.img).toBe(ContentImage)
  })

  it.each([
    [true, 'Đã xong'],
    [false, 'Chưa xong'],
  ])(
    'renders a GFM task checkbox (checked: %s) as a labelled marker, not a control',
    (checked, label) => {
      const Input = lookup.input!
      const { container } = render(<Input type="checkbox" checked={checked} disabled />)
      expect(container.querySelector('input')).toBeNull()
      expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
      expect(screen.getByText(label).className).toContain('sr-only')
    },
  )

  it('renders no other input type', () => {
    const Input = lookup.input!
    const { container } = render(<Input type="text" />)
    expect(container.innerHTML).toBe('')
  })

  it.each([
    ['th', 'center', 'text-center'],
    ['td', 'right', 'text-right'],
    ['td', 'left', 'text-left'],
  ])('maps GFM %s alignment %s to %s, never a style attribute', (tag, align, token) => {
    const Cell = lookup[tag]!
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <Cell {...{ style: { textAlign: align } }}>x</Cell>
          </tr>
        </tbody>
      </table>,
    )
    const cell = container.querySelector(tag)!
    expect(cell.getAttribute('style')).toBeNull()
    expect(cell.className).toContain(token)
  })

  it('drops list bullets for a GFM task list', () => {
    const Ul = lookup.ul!
    const { container } = render(<Ul {...{ className: TASK_LIST }}>x</Ul>)
    expect(container.querySelector('ul')?.className).toContain('list-none')
    expect(container.querySelector('ul')?.className).not.toContain('list-disc')
  })

  it('styles inline code in the mono font', () => {
    const Code = lookup.code!
    render(<Code>left</Code>)
    expect(screen.getByText('left').className).toContain('font-mono')
  })
})
