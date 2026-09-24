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

test.describe('theme toggle on a phone', () => {
  test.use({ viewport: { width: 390, height: 800 } })

  test('each option stays on one line and the page never scrolls sideways', async ({ page }) => {
    await page.goto('/dev/components')
    const group = page.getByRole('radiogroup', { name: 'Giao diện' }).first()
    const heights = await group
      .getByRole('radio')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))
    expect(heights).toHaveLength(3)
    for (const height of heights) expect(height).toBeLessThanOrEqual(48)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBe(0)
  })
})

test.describe('filter chips', () => {
  test.use({ viewport: { width: 390, height: 800 } })

  test('are 32 px tall, hit-testable over 44 px, and never overlap (DESIGN_SYSTEM §5)', async ({
    page,
  }) => {
    await page.goto('/dev/components')
    const chips = page.getByRole('group', { name: 'Lọc theo trạng thái' }).getByRole('button')
    expect(await chips.count()).toBeGreaterThanOrEqual(4)
    const result = await chips.evaluateAll((els) => {
      const hit = (el: Element, x: number, y: number) => {
        const target = document.elementFromPoint(x, y)
        return target !== null && (target === el || el.contains(target))
      }
      // Scroll once so every rect shares one coordinate space.
      els[0]?.parentElement?.scrollIntoView({ block: 'center' })
      return els.map((el) => {
        const r = el.getBoundingClientRect()
        const x = r.left + r.width / 2
        return {
          height: r.height,
          // >= 44 px: 32 px + 6 px each side (probe just inside 6 px).
          top: hit(el, x, r.top - 5.9),
          bottom: hit(el, x, r.bottom + 5.9),
          // The largest possible hit area (8 px each side) for the overlap check.
          rect: { left: r.left, right: r.right, top: r.top - 8, bottom: r.bottom + 8 },
        }
      })
    })
    for (const chip of result) {
      expect(chip.height).toBeCloseTo(32, 0)
      expect(chip.top && chip.bottom).toBe(true)
    }
    // Expanded hit areas of different chips never intersect (>= 8 px apart in a row).
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const [a, b] = [result[i]!.rect, result[j]!.rect]
        const apart =
          a.right + 8 <= b.left || b.right + 8 <= a.left || a.bottom <= b.top || b.bottom <= a.top
        expect(apart, `chips ${i} and ${j} overlap`).toBe(true)
      }
    }
  })
})
