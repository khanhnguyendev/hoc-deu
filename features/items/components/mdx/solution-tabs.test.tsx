import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { HighlightedCode } from '@/lib/content/code-tokens'
import { SolutionTabs } from './solution-tabs'

const PYTHON: HighlightedCode = { lang: 'python', lines: [[['class', 'keyword'], ' Solution:']] }
const JAVA: HighlightedCode = {
  lang: 'java',
  lines: [[['class', 'keyword'], ' Solution {'], ['}']],
}
const GO: HighlightedCode = { lang: 'go', lines: [[['func', 'keyword'], ' twoSum() {}']] }

describe('SolutionTabs', () => {
  it('puts no code in the DOM before "Xem lời giải"', () => {
    const { container } = render(
      <SolutionTabs solutions={{ python: PYTHON, java: JAVA, go: GO }} defaultLanguage="java" />,
    )
    expect(container.querySelector('pre')).toBeNull()
    expect(container.textContent).not.toContain('Solution')
    const show = screen.getByRole('button', { name: 'Xem lời giải' })
    expect(show.getAttribute('aria-expanded')).toBe('false')
  })

  it("opens on the viewer's language, with only the present languages in order", async () => {
    const user = userEvent.setup()
    render(<SolutionTabs solutions={{ go: GO, python: PYTHON }} defaultLanguage="go" />)
    await user.click(screen.getByRole('button', { name: 'Xem lời giải' }))

    const tabs = within(screen.getByRole('tablist', { name: 'Ngôn ngữ lời giải' }))
    expect(tabs.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Python', 'Go'])
    expect(tabs.getByRole('tab', { name: 'Go' }).getAttribute('aria-selected')).toBe('true')
    const code = screen.getByRole('region', { name: 'Lời giải Go' })
    expect(code.textContent).toContain('func twoSum')
    expect(screen.getByRole('button', { name: 'Ẩn lời giải' })).toBeTruthy()
  })

  it('opens on the first language when the viewer’s is missing, and switches tabs', async () => {
    const user = userEvent.setup()
    render(<SolutionTabs solutions={{ java: JAVA, python: PYTHON }} defaultLanguage="go" />)
    await user.click(screen.getByRole('button', { name: 'Xem lời giải' }))
    expect(screen.getByRole('tab', { name: 'Python' }).getAttribute('aria-selected')).toBe('true')

    await user.click(screen.getByRole('tab', { name: 'Java' }))
    expect(screen.getByRole('region', { name: 'Lời giải Java' }).textContent).toContain(
      'class Solution',
    )
  })

  it('fires onReveal once, however often it is opened', async () => {
    const onReveal = vi.fn()
    const user = userEvent.setup()
    render(
      <SolutionTabs solutions={{ python: PYTHON }} defaultLanguage="python" onReveal={onReveal} />,
    )
    await user.click(screen.getByRole('button', { name: 'Xem lời giải' }))
    await user.click(screen.getByRole('button', { name: 'Ẩn lời giải' }))
    expect(screen.queryByRole('tablist')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Xem lời giải' }))
    expect(onReveal).toHaveBeenCalledOnce()
  })

  it('renders nothing without solutions', () => {
    const { container } = render(<SolutionTabs solutions={{}} defaultLanguage="python" />)
    expect(container.innerHTML).toBe('')
  })
})
