import { expectNoAxeViolations } from './support/axe'
import { expect, test } from './support/test'

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`not found (${colorScheme})`, () => {
    // `/sign-in` itself is built in task 2.7a; until then the redirect target answers 404 too.
    test.use({ colorScheme, allowedConsoleErrors: [/status of 404/] })

    test('a signed-out visit to an unknown URL goes to sign-in with next', async ({ page }) => {
      const response = await page.goto('/khong-ton-tai?x=1')
      const redirect = await response?.request().redirectedFrom()?.response()
      expect(redirect?.status()).toBe(307)
      const url = new URL(page.url())
      expect(url.pathname).toBe('/sign-in')
      expect(url.searchParams.get('next')).toBe('/khong-ton-tai?x=1')
    })

    // An unknown path that needs no session (the /dev catalog is public outside production) —
    // task 2.7a adds the signed-in case.
    test('an unknown public URL shows the Vietnamese 404 with a way home', async ({ page }) => {
      const response = await page.goto('/dev/khong-ton-tai')
      expect(response?.status()).toBe(404)
      await expect(
        page.getByRole('heading', { level: 1, name: 'Không tìm thấy trang' }),
      ).toBeVisible()
      await expect(page.getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/')
      await expectNoAxeViolations(page)
    })
  })
}
