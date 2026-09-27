/**
 * `test` extended so every test fails on any browser `console` error or `pageerror` — a script
 * error, a failed fetch, a React warning promoted to `console.error`, and so on never pass
 * silently. `allowedConsoleErrors` lets a spec allow specific, expected errors by pattern.
 */
import { test as base, type ConsoleMessage } from '@playwright/test'

export type TestOptions = {
  /** Console/page errors matching any of these patterns are ignored. Default: none. */
  allowedConsoleErrors: RegExp[]
}

export const test = base.extend<TestOptions>({
  allowedConsoleErrors: [[], { option: true }],
  page: async ({ page, allowedConsoleErrors }, use) => {
    const errors: string[] = []

    // Every route the AppShell links exists since M5, so a 404 on a prefetch is a broken link
    // and fails the test like any other console error (UI m-8).
    const isAllowed = (text: string) => allowedConsoleErrors.some((p) => p.test(text))

    const onConsole = (message: ConsoleMessage) => {
      if (message.type() !== 'error') return
      const text = message.text()
      if (isAllowed(text)) return
      errors.push(text)
    }
    const onPageError = (error: Error) => {
      if (isAllowed(error.message)) return
      errors.push(error.message)
    }

    page.on('console', onConsole)
    page.on('pageerror', onPageError)

    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture, not a React hook.
    await use(page)

    page.off('console', onConsole)
    page.off('pageerror', onPageError)

    if (errors.length > 0) {
      throw new Error(`Unexpected browser console/page error(s):\n${errors.join('\n')}`)
    }
  },
})

export { expect } from '@playwright/test'
