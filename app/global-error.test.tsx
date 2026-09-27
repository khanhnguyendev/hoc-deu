import { render, screen } from '@testing-library/react'
import type * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { vi as strings } from '@/lib/i18n/vi'

// `next/font/local` is a build-time macro (Next's compiler rewrites the call); under Vitest it is
// only ever a plain function, so it needs a stand-in here — the same reason no other test renders
// a file that imports app/fonts/fonts.ts.
vi.mock('next/font/local', () => ({
  default: () => ({ variable: '--mock-font', className: 'mock-font' }),
}))

const { default: GlobalError } = await import('./global-error')

/**
 * GlobalError is a whole document (`<html>`): render it as the document, as Next does — RTL's
 * default container is a `<div>`, where React warns that `<html>` cannot be a child of it (parked
 * #5). React 19 renders the `html` / `body` singletons into the existing ones.
 */
const renderDocument = (ui: React.ReactElement) => render(ui, { container: document })

// next-themes reads localStorage and writes the class straight onto document.documentElement
// (never a ref to the tree it renders), so a saved theme is set up and checked on the real
// document, the same way the browser applies it before paint (M1 #17).
// next-themes' anti-flash `<script>` runs before paint in the browser; a client render in jsdom
// only makes React warn that it will not run it. That one warning is the harness's (parked #5);
// any other console error still fails the test.
const SCRIPT_WARNING = /^Encountered a script tag while rendering React component/
let consoleErrors: unknown[][] = []

beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ''
  consoleErrors = []
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && SCRIPT_WARNING.test(args[0])) return
    consoleErrors.push(args)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  document.documentElement.className = ''
  expect(consoleErrors).toEqual([])
})

describe('GlobalError', () => {
  it('applies a saved dark theme to <html> (M1 #17)', () => {
    localStorage.setItem('theme', 'dark')
    renderDocument(<GlobalError error={new Error('boom')} retry={() => {}} />)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('applies a saved light theme to <html>', () => {
    localStorage.setItem('theme', 'light')
    renderDocument(<GlobalError error={new Error('boom')} retry={() => {}} />)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('still shows the crash title and a working retry button with no saved theme', () => {
    let retried = false
    renderDocument(<GlobalError error={new Error('boom')} retry={() => (retried = true)} />)
    expect(
      screen.getByRole('heading', { level: 1, name: strings.states.globalErrorTitle }),
    ).toBeTruthy()
    screen.getByRole('button', { name: strings.common.retry }).click()
    expect(retried).toBe(true)
  })
})
