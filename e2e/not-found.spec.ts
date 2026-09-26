import { expectNoAxeViolations, expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn } from './support/auth'
import { expect, test } from './support/test'
import { createTestUser, deleteTestUser, seedLearnerSetup } from './support/users'

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`not found (${colorScheme})`, () => {
    // The 404 page answers with status 404, which Chromium logs as a failed resource load.
    test.use({ colorScheme, allowedConsoleErrors: [/status of 404/] })

    test('a signed-out visit to an unknown URL goes to sign-in with next', async ({ page }) => {
      const response = await page.goto('/khong-ton-tai?x=1')
      const redirect = await response?.request().redirectedFrom()?.response()
      expect(redirect?.status()).toBe(307)
      const url = new URL(page.url())
      expect(url.pathname).toBe('/sign-in')
      expect(url.searchParams.get('next')).toBe('/khong-ton-tai?x=1')
    })

    // An unknown path that needs no session (the /dev catalog is public outside production).
    test('an unknown public URL shows the Vietnamese 404 with a way home', async ({ page }) => {
      const response = await page.goto('/dev/khong-ton-tai')
      expect(response?.status()).toBe(404)
      await expect(
        page.getByRole('heading', { level: 1, name: 'Không tìm thấy trang' }),
      ).toBeVisible()
      await expect(page.getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/')
      await expectNoAxeViolations(page)
    })

    test('a signed-in user gets the Vietnamese 404 with a way home', async ({ page }) => {
      const learner = await createTestUser({ status: 'active', onboarded: true })
      try {
        await signIn(page, learner)
        const response = await page.goto('/khong-ton-tai')
        expect(response?.status()).toBe(404)
        await expect(
          page.getByRole('heading', { level: 1, name: 'Không tìm thấy trang' }),
        ).toBeVisible()
        await expect(page.getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/')
        await expectNoAxeViolations(page)
      } finally {
        await deleteTestUser(learner.id)
      }
    })
  })
}

/**
 * `/t/[trackId]` and its item route answer a real HTTP 404 (task 5.1c: `(app)/loading.tsx` was
 * removed, so `notFound()` in the loader runs before anything streams — see `(app)/not-found.tsx`
 * for the rule). One onboarded learner enrolled in DSA only, so an English item's track never
 * matches under `/t/dsa` (decision: track mismatch reads the same as an unknown item).
 */
test.describe('unknown tracks and items', () => {
  // The 404 responses log as failed resource loads in Chromium.
  test.use({ allowedConsoleErrors: [/status of 404/] })

  test('an unknown track, an unknown item and a track-mismatched item all answer 404; a real one 200', async ({
    page,
  }) => {
    const learner = await createTestUser({ onboarded: true })
    try {
      await seedLearnerSetup(learner.id, {
        tracks: [
          { trackId: 'dsa', roadmapVariant: '8w', budgetMinutes: 60, startDate: '2026-09-01' },
        ],
      })
      await signIn(page, learner, '/tracks')

      for (const path of ['/t/khong-co', '/t/dsa/items/lc-99999', '/t/dsa/items/ex-w01-fill-1']) {
        const response = await page.goto(path)
        expect(response?.status(), path).toBe(404)
        await expect(
          page.getByRole('heading', { level: 1, name: 'Không tìm thấy trang' }),
          path,
        ).toBeVisible()
        await expect(page.getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/')
        // One main landmark: the AppShell's (no second one from a whole 404 page).
        await expect(page.getByRole('main')).toHaveCount(1)
      }
      await expectNoAxeViolationsInBothThemes(page)

      const ok = await page.goto('/t/dsa/items/lc-0001')
      expect(ok?.status()).toBe(200)
      await expect(page.getByRole('heading', { level: 1, name: 'Two Sum' })).toBeVisible()
    } finally {
      await deleteTestUser(learner.id)
    }
  })
})
