import { expectNoAxeViolations } from './support/axe'
import { expect, test } from './support/test'

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`not found (${colorScheme})`, () => {
    test.use({ colorScheme, allowedConsoleErrors: [/status of 404/] })

    test('an unknown URL shows the Vietnamese 404 with a way home', async ({ page }) => {
      const response = await page.goto('/khong-ton-tai')
      expect(response?.status()).toBe(404)
      await expect(
        page.getByRole('heading', { level: 1, name: 'Không tìm thấy trang' }),
      ).toBeVisible()
      await expect(page.getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/')
      await expectNoAxeViolations(page)
    })
  })
}
