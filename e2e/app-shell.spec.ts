import { expect, test, type Page } from '@playwright/test'

/** The page-level behaviour of the real AppShell (app/dev/app-shell). */
const rect = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect)

test.describe('AppShell on a phone', () => {
  test.use({ viewport: { width: 390, height: 700 } })

  test('keyboard focus is never hidden under the top bar or the bottom navigation', async ({
    page,
  }) => {
    await page.goto('/dev/app-shell')
    const nav = await rect(page, 'nav[aria-label="Điều hướng chính"]:visible')
    const header = await rect(page, 'header:visible')
    const hidden: string[] = []
    for (let i = 0; i < 45; i++) {
      await page.keyboard.press('Tab')
      const focused = await page.evaluate(() => {
        const el = document.activeElement
        // Skip the bars themselves and fixed overlays (the skip link sits on top of the top bar).
        if (!el || el === document.body || el.closest('nav, header')) return null
        if (getComputedStyle(el).position === 'fixed') return null
        const r = el.getBoundingClientRect()
        return { name: el.textContent?.trim() ?? '', top: r.top, bottom: r.bottom }
      })
      // The focus ring extends 4 px beyond the element (2 px outline + 2 px offset).
      if (focused && (focused.bottom + 4 > nav.top || focused.top - 4 < header.bottom)) {
        hidden.push(focused.name)
      }
    }
    expect(hidden).toEqual([])
  })

  test('toasts sit above the bottom navigation', async ({ page }) => {
    await page.goto('/dev/app-shell')
    await page.getByRole('button', { name: 'Hiện thông báo' }).click()
    const nav = await rect(page, 'nav[aria-label="Điều hướng chính"]:visible')
    // Sonner slides toasts up from below; poll until the toast has settled.
    await expect
      .poll(async () => (await rect(page, '[data-sonner-toast]')).bottom)
      .toBeLessThanOrEqual(nav.top)
  })

  test('leaves safe areas to the browser (no viewport-fit=cover)', async ({ page }) => {
    await page.goto('/dev/app-shell')
    const content = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(content).not.toContain('viewport-fit=cover')
  })
})

for (const width of [768, 900, 1024]) {
  test.describe(`AppShell at ${width} px`, () => {
    test.use({ viewport: { width, height: 800 } })

    test('the heatmap year view shows today and the page never scrolls sideways', async ({
      page,
    }) => {
      await page.goto('/dev/app-shell')
      const scroller = await rect(page, '[data-view="year"]')
      const today = await rect(page, '[data-view="year"] [aria-current="date"]')
      expect(today.left).toBeGreaterThanOrEqual(scroller.left)
      expect(today.right).toBeLessThanOrEqual(scroller.right)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBe(0)
    })

    test('toasts stay clear of the bottom navigation', async ({ page }) => {
      await page.goto('/dev/app-shell')
      await page.getByRole('button', { name: 'Hiện thông báo' }).click()
      const navs = page.locator('nav[aria-label="Điều hướng chính"]:visible')
      const bottomNav = await navs.evaluateAll((els) =>
        els
          .map((el) => el.getBoundingClientRect().toJSON() as DOMRect)
          .find((r) => r.bottom >= window.innerHeight - 1 && r.top > window.innerHeight / 2),
      )
      const limit = bottomNav ? bottomNav.top : await page.evaluate(() => window.innerHeight)
      // Sonner slides toasts up from below; poll until the toast has settled.
      await expect
        .poll(async () => (await rect(page, '[data-sonner-toast]')).bottom)
        .toBeLessThanOrEqual(limit)
    })
  })
}

test.describe('catalog width', () => {
  for (const width of [768, 1024]) {
    test(`/dev/components never scrolls sideways at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/dev/components')
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBe(0)
    })
  }
})
