import { expectNoAxeViolations } from './support/axe'
import { expect, test } from './support/test'

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

    test('loads only self-hosted fonts', async ({ page }) => {
      const hosts: string[] = []
      page.on('request', (request) => hosts.push(new URL(request.url()).hostname))
      await page.goto('/')
      const loaded = await page.evaluate(async () => {
        await document.fonts.ready
        return [...document.fonts].filter((face) => face.status === 'loaded').length
      })
      expect(loaded).toBeGreaterThan(0)
      expect(hosts.filter((h) => /(?:googleapis|gstatic)\.com$/.test(h))).toEqual([])
    })

    test('has no WCAG 2.1 AA violations', async ({ page }) => {
      await page.goto('/')
      await expectNoAxeViolations(page)
    })
  })
}

test('light and dark themes paint different backgrounds', async ({ page }) => {
  const background = () =>
    page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  const light = await background()
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(await background()).not.toBe(light)
})
