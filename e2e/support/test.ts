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

// The AppShell's links prefetch /review, /tracks, /progress, /admin/content, which 404 until
// M3/M5 — Next's RSC prefetch failures log a "Failed to load resource: the server responded with
// a status of 404 (Not Found)" console error for the `?_rsc=` request. That is expected until
// those routes exist, so it is ignored — but only a 404: a 5xx on a prefetch always fails the test.
const isIgnoredRscPrefetchError = (text: string, url: string | undefined) =>
  text.includes('Failed to load resource') &&
  text.includes('status of 404') &&
  Boolean(url?.includes('_rsc='))

export const test = base.extend<TestOptions>({
  allowedConsoleErrors: [[], { option: true }],
  page: async ({ page, allowedConsoleErrors }, use) => {
    const errors: string[] = []

    const isAllowed = (text: string, url?: string) =>
      isIgnoredRscPrefetchError(text, url) || allowedConsoleErrors.some((p) => p.test(text))

    const onConsole = (message: ConsoleMessage) => {
      if (message.type() !== 'error') return
      const text = message.text()
      if (isAllowed(text, message.location().url)) return
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
