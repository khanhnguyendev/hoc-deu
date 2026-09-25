import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CodeBlock, type HighlightedCode } from './code-block'

const CODE: HighlightedCode = {
  lang: 'python',
  lines: [
    [['class', 'keyword'], ' Solution: ', ['1', 'constant']],
    [],
    ['    ', ['# a comment', 'comment']],
  ],
}

describe('CodeBlock', () => {
  it('renders a focusable region named by the label', () => {
    render(<CodeBlock code={CODE} label="Lời giải Python" />)
    const region = screen.getByRole('region', { name: 'Lời giải Python' })
    expect(region.tagName).toBe('PRE')
    expect(region.getAttribute('tabindex')).toBe('0')
  })

  it('renders keyword runs with text-primary', () => {
    render(<CodeBlock code={CODE} label="Lời giải Python" />)
    const keyword = screen.getByText('class')
    expect(keyword.className).toContain('text-primary')
  })

  it('renders comment runs as italic', () => {
    render(<CodeBlock code={CODE} label="Lời giải Python" />)
    const comment = screen.getByText('# a comment')
    expect(comment.className).toContain('italic')
  })

  it('renders an empty line without collapsing its height', () => {
    render(<CodeBlock code={CODE} label="Lời giải Python" />)
    const region = screen.getByRole('region', { name: 'Lời giải Python' })
    const lines = region.querySelectorAll(':scope > span')
    expect(lines).toHaveLength(3)
    expect(lines[1]?.textContent).toBe('​')
  })
})
