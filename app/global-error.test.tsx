import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { vi as strings } from '@/lib/i18n/vi'

// `next/font/local` is a build-time macro (Next's compiler rewrites the call); under Vitest it is
// only ever a plain function, so it needs a stand-in here — the same reason no other test renders
// a file that imports app/fonts/fonts.ts.
vi.mock('next/font/local', () => ({
  default: () => ({ variable: '--mock-font', className: 'mock-font' }),
}))

const { default: GlobalError } = await import('./global-error')

// next-themes reads localStorage and writes the class straight onto document.documentElement
// (never a ref to the tree it renders), so a saved theme is set up and checked on the real
// document, the same way the browser applies it before paint (M1 #17).
beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ''
})

afterEach(() => {
  localStorage.clear()
  document.documentElement.className = ''
})

describe('GlobalError', () => {
  it('applies a saved dark theme to <html> (M1 #17)', () => {
    localStorage.setItem('theme', 'dark')
    render(<GlobalError error={new Error('boom')} retry={() => {}} />)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('applies a saved light theme to <html>', () => {
    localStorage.setItem('theme', 'light')
    render(<GlobalError error={new Error('boom')} retry={() => {}} />)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('still shows the crash title and a working retry button with no saved theme', () => {
    let retried = false
    render(<GlobalError error={new Error('boom')} retry={() => (retried = true)} />)
    expect(
      screen.getByRole('heading', { level: 1, name: strings.states.globalErrorTitle }),
    ).toBeTruthy()
    screen.getByRole('button', { name: strings.common.retry }).click()
    expect(retried).toBe(true)
  })
})
