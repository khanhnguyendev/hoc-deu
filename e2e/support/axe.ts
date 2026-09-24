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
