import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Term } from './term'

describe('Term', () => {
  it('wraps the English term in lang="en"', () => {
    render(
      <p>
        Dùng <Term>two pointers</Term> nhé.
      </p>,
    )
    const term = screen.getByText('two pointers')
    expect(term.tagName).toBe('SPAN')
    expect(term.getAttribute('lang')).toBe('en')
  })

  it('adds the Vietnamese gloss after the term, outside lang="en"', () => {
    const { container } = render(
      <p>
        Dùng <Term vi="hai con trỏ">two pointers</Term> nhé.
      </p>,
    )
    expect(container.textContent).toBe('Dùng two pointers (hai con trỏ) nhé.')
    expect(screen.getByText('two pointers').getAttribute('lang')).toBe('en')
    const english = container.querySelector('[lang="en"]')
    expect(english?.textContent).toBe('two pointers')
  })
})
