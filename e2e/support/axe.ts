import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect } from './test'

export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/** Scans the full page for WCAG 2.1 A/AA violations and asserts there are none. */
export async function expectNoAxeViolations(
  page: Page,
  options?: { disableRules?: string[] },
): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS)
  if (options?.disableRules) builder = builder.disableRules(options.disableRules)
  const results = await builder.analyze()
  expect(results.violations).toEqual([])
}

/**
 * Scans the current page in the light and then the dark theme: switches `prefers-color-scheme`,
 * waits for next-themes to set the `dark` class accordingly, then runs axe. For flows whose users
 * cannot be created twice in parallel (one fixed e-mail), and to scan each page of a flow in both
 * themes without repeating the flow. `options` as for `expectNoAxeViolations` (an open overlay
 * disables `aria-hidden-focus`, M1 deferred #19).
 */
export async function expectNoAxeViolationsInBothThemes(
  page: Page,
  options?: { disableRules?: string[] },
): Promise<void> {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
      .toBe(colorScheme === 'dark')
    await expectNoAxeViolations(page, options)
  }
}
