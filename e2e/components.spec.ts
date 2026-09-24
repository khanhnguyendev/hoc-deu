import { readFileSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
// Entry names straight from the registry source, so a new entry is checked without editing this file.
const NAMES = [
  ...readFileSync('app/dev/components/registry.tsx', 'utf8').matchAll(/name: '([^']+)'/g),
].map((m) => m[1] ?? '')

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`/dev/components (${colorScheme})`, () => {
    test.use({ colorScheme })

    test('renders every catalog entry with no WCAG 2.1 AA violations', async ({ page }) => {
      await page.goto('/dev/components')
      expect(NAMES.length).toBeGreaterThanOrEqual(30)
      for (const name of NAMES) {
        await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeAttached()
      }
      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze()
      expect(results.violations).toEqual([])
    })

    // Scoped to the overlay: while a Radix modal is open the rest of the page is aria-hidden with
    // focus trapped in the overlay (not `inert`), which axe reports as aria-hidden-focus.
    test('open overlays pass axe', async ({ page }) => {
      await page.goto('/dev/components')
      await page.getByRole('button', { name: 'Mở hộp thoại' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      const dialog = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(WCAG)
        .analyze()
      expect(dialog.violations).toEqual([])
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Mở menu mẫu' }).click()
      await expect(page.getByRole('menu')).toBeVisible()
      const menu = await new AxeBuilder({ page }).include('[role="menu"]').withTags(WCAG).analyze()
      expect(menu.violations).toEqual([])
    })
  })
}

test.describe('dialog footer on a phone', () => {
  test.use({ viewport: { width: 390, height: 800 } })

  test('tab order follows the visual order of the footer buttons (WCAG 2.4.3)', async ({
    page,
  }) => {
    await page.goto('/dev/components')
    await page.getByRole('button', { name: 'Mở hộp thoại' }).click()
    const boxes = await page
      .locator('[data-slot="dialog-footer"] button')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect))
    expect(boxes.length).toBeGreaterThan(1)
    for (let i = 1; i < boxes.length; i++) {
      const [a, b] = [boxes[i - 1]!, boxes[i]!]
      const later = b.top > a.top + 1 || (Math.abs(b.top - a.top) <= 1 && b.left > a.left)
      expect(later, `button ${i} is placed before button ${i - 1}`).toBe(true)
    }
  })
})
