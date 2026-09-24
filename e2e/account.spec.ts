import type { Page } from '@playwright/test'
import { expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn } from './support/auth'
import { expect, test } from './support/test'
import { createTestUser, deleteTestUser, setStatus, type TestUser } from './support/users'

/** Pending screen, landing page and AppShell sign-out (task 2.7b, §2.4, §5). */

// Users this test created; removed after each test (one user per test, decision 14).
const created: string[] = []
async function user(options?: Parameters<typeof createTestUser>[0]): Promise<TestUser> {
  const testUser = await createTestUser(options)
  created.push(testUser.id)
  return testUser
}
test.afterEach(async () => {
  await Promise.all(created.splice(0).map((id) => deleteTestUser(id)))
})

/** Waits until the page is at `path` (redirects may still be in flight after a click). */
const expectPath = (page: Page, path: string) =>
  expect(page).toHaveURL((url) => url.pathname === path)

test.describe('/pending', () => {
  test('a pending user sees the pending copy, and moves on by itself once approved', async ({
    page,
  }) => {
    const learner = await user({ status: 'pending' })
    await signIn(page, learner)
    await expectPath(page, '/pending')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Tài khoản của bạn đang chờ duyệt' }),
    ).toBeVisible()
    await expect(
      page.getByText('Quản trị viên sẽ duyệt sớm. Trang này tự chuyển khi tài khoản được duyệt.'),
    ).toBeVisible()
    await expectNoAxeViolationsInBothThemes(page)

    // The admin API approves the account; StatusWatcher refreshes the page on `focus`.
    await setStatus(learner.id, 'active')
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expectPath(page, '/onboarding')
  })

  for (const [status, title] of [
    ['rejected', 'Tài khoản chưa được duyệt'],
    ['suspended', 'Tài khoản đang tạm khoá'],
  ] as const) {
    test(`a ${status} user sees the ${status} copy and can sign out`, async ({ page }) => {
      const learner = await user({ status })
      await signIn(page, learner)
      await expectPath(page, '/pending')
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
      await expectNoAxeViolationsInBothThemes(page)

      await page.getByRole('button', { name: 'Đăng xuất' }).click()
      await expectPath(page, '/sign-in')
    })
  }
})

test.describe('AppShell sign-out', () => {
  test('an active onboarded user can sign out from the account menu; /today then needs sign-in again', async ({
    page,
  }, testInfo) => {
    const learner = await user({ status: 'active', onboarded: true })
    await signIn(page, learner, '/today')
    await expectPath(page, '/today')

    // The mobile top bar's title is derived from the path (R3); the desktop sidebar hides it.
    if (testInfo.project.name === 'mobile') {
      await expect(page.getByRole('banner').getByText('Hôm nay')).toBeVisible()
    }
    await expectNoAxeViolationsInBothThemes(page)

    await page
      .getByRole('button', { name: /^Tài khoản/ })
      .first()
      .click()
    await page.getByRole('menuitem', { name: 'Đăng xuất' }).click()
    await expectPath(page, '/sign-in')

    await page.goto('/today')
    await expectPath(page, '/sign-in')
  })
})

test.describe('/', () => {
  test('a signed-in user visiting / goes to their home path', async ({ page }) => {
    const learner = await user({ status: 'active', onboarded: true })
    await signIn(page, learner)
    await expectPath(page, '/today')

    await page.goto('/')
    await expectPath(page, '/today')
  })
})
