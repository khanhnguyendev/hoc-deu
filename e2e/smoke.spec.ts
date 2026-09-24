import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`home page (${colorScheme})`, () => {
    test.use({ colorScheme })

    test('renders in Vietnamese with the design tokens applied', async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('html')).toHaveAttribute('lang', 'vi')
      await expect(page.getByRole('heading', { level: 1, name: 'Học Đều' })).toBeVisible()
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
      expect(isDark).toBe(colorScheme === 'dark')
      const { painted, token } = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement)
        return {
          painted: style.backgroundColor,
          token: style.getPropertyValue('--background').trim(),
        }
      })
      // Tailwind compiles the OKLCH tokens (it may emit lab()); the page must paint the token colour.
      expect(token).not.toBe('')
      expect(painted).not.toBe('rgba(0, 0, 0, 0)')
    })

    test('has no WCAG 2.1 AA violations', async ({ page }) => {
      await page.goto('/')
      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze()
      expect(results.violations).toEqual([])
    })
  })
}
