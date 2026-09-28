import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect } from './test'

export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/**
 * Sonner fades toasts in and out, and axe measures a half-transparent toast's text against the page
 * (a contrast violation that exists only mid-animation). Waits until every toast on the page is
 * fully opaque and none is leaving.
 */
async function settleToasts(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('[data-sonner-toast]')).every(
          (toast) =>
            toast.dataset.removed !== 'true' && window.getComputedStyle(toast).opacity === '1',
        ),
      ),
    )
    .toBe(true)
}

/**
 * Waits until every running finite animation and transition has finished: switching the theme
 * animates `transition-colors` elements (a dialog's primary button), and axe once measured one
 * halfway between the dark and the light primary (4.37:1, M6 e2e fix round 2) — a state no one sees
 * for longer than `--duration-fast`. Infinite animations (a spinner, a skeleton's pulse) never
 * finish and are left alone.
 */
async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => {})),
    ),
  )
}

/**
 * Scans the full page for WCAG 2.1 A/AA violations and asserts there are none, once the toasts and
 * every running animation have settled.
 */
export async function expectNoAxeViolations(
  page: Page,
  options?: { disableRules?: string[] },
): Promise<void> {
  await settleToasts(page)
  await settleAnimations(page)
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
