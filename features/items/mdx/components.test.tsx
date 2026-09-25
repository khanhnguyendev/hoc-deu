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
] as const

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

  it('styles inline code in the mono font', () => {
    const Code = lookup.code!
    render(<Code>left</Code>)
    expect(screen.getByText('left').className).toContain('font-mono')
  })
})
