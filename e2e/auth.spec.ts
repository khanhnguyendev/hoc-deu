import type { Page } from '@playwright/test'
import { expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn, testLoginForm } from './support/auth'
import { expect, test } from './support/test'
import {
  createTestUser,
  deleteTestUser,
  deleteUserByEmail,
  getProfile,
  type TestUser,
} from './support/users'

/** Sign-in, OAuth callback, test login and the guarded route groups (task 2.7a, §2.2–§2.5). */

const OAUTH_ERROR = 'Đăng nhập không thành công. Bạn thử lại nhé.'
const WRONG_CREDENTIALS = 'Email hoặc mật khẩu không đúng.'

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

/** The AppShell's main navigation (sidebar from 1024 px, bottom navigation below). */
const appNavigation = (page: Page) =>
  page.locator('nav[aria-label="Điều hướng chính"]').filter({ visible: true }).first()

test.describe('signed out', () => {
  test('a private page goes to /sign-in with next; it offers both providers and the test login', async ({
    page,
  }) => {
    await page.goto('/today')
    const url = new URL(page.url())
    expect(url.pathname).toBe('/sign-in')
    expect(url.search).toBe('?next=%2Ftoday')
    await expect(page.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tiếp tục với Google' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tiếp tục với GitHub' })).toBeVisible()
    const form = testLoginForm(page)
    await expect(form.getByLabel('Email')).toBeVisible()
    await expect(form.getByLabel('Mật khẩu')).toBeVisible()
    await expect(page.getByText(OAUTH_ERROR)).toHaveCount(0)
    await expectNoAxeViolationsInBothThemes(page)
  })

  for (const [label, provider] of [
    ['Tiếp tục với Google', 'google'],
    ['Tiếp tục với GitHub', 'github'],
  ] as const) {
    test(`"${label}" starts ${provider} OAuth with the callback URL and the safe next`, async ({
      page,
      baseURL,
    }) => {
      // The real provider round trip is an owner check on staging (decision 4); here the
      // Supabase authorize request is caught and answered locally.
      let authorize: URL | undefined
      await page.route(
        (url) => url.pathname === '/auth/v1/authorize',
        async (route) => {
          authorize = new URL(route.request().url())
          await route.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><html lang="en"><title>OAuth</title><p>OAuth</p></html>',
          })
        },
      )
      await page.goto('/sign-in?next=%2Ftoday')
      await page.getByRole('button', { name: label }).click()
      await expect.poll(() => authorize?.searchParams.get('provider')).toBe(provider)
      expect(authorize?.origin).toBe(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin)
      expect(authorize?.searchParams.get('redirect_to')).toBe(
        `${baseURL}/auth/callback?next=%2Ftoday`,
      )
      // PKCE: the code verifier stays in a cookie; only its challenge goes to the provider.
      expect(authorize?.searchParams.get('code_challenge')).toBeTruthy()
    })
  }

  test('an OAuth callback without a valid code returns to /sign-in with the error', async ({
    page,
  }) => {
    for (const [callback, next] of [
      ['/auth/callback?next=%2Ftoday', '/today'], // e.g. the provider sent ?error=access_denied
      ['/auth/callback?code=not-a-code&next=%2F%2Fevil.test', null],
    ] as const) {
      await page.goto(callback)
      const url = new URL(page.url())
      expect(url.pathname).toBe('/sign-in')
      expect(url.searchParams.get('error')).toBe('oauth')
      // A safe next survives the failure, so trying again still ends where the user was going.
      expect(url.searchParams.get('next')).toBe(next)
      await expect(page.getByText(OAUTH_ERROR)).toBeVisible()
    }
    await expectNoAxeViolationsInBothThemes(page)
  })

  test('a wrong password shows the error and stays on /sign-in', async ({ page }) => {
    const learner = await user({ onboarded: true })
    await page.goto('/sign-in?next=%2Ftoday')
    const form = testLoginForm(page)
    await form.getByLabel('Email').fill(learner.email)
    await form.getByLabel('Mật khẩu').fill('wrong-password')
    await form.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(form.getByRole('alert')).toHaveText(WRONG_CREDENTIALS)
    await expectPath(page, '/sign-in')
    await expectNoAxeViolationsInBothThemes(page)
  })
})

test.describe('signing in with the test login', () => {
  test('a pending user lands on /pending', async ({ page }) => {
    await signIn(page, await user({ status: 'pending' }))
    await expectPath(page, '/pending')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Tài khoản của bạn đang chờ duyệt' }),
    ).toBeVisible()
    await expectNoAxeViolationsInBothThemes(page)
  })

  test('an active user who has not onboarded lands on /onboarding', async ({ page }) => {
    await signIn(page, await user({ status: 'active' }))
    await expectPath(page, '/onboarding')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chào mừng bạn đến Học Đều')
    await expectNoAxeViolationsInBothThemes(page)
  })

  test('an active onboarded user with next=/today lands on /today inside the AppShell', async ({
    page,
  }) => {
    await signIn(page, await user({ status: 'active', onboarded: true }), '/today')
    await expectPath(page, '/today')
    await expect(page.getByRole('heading', { level: 1, name: 'Hôm nay' })).toBeVisible()
    await expect(appNavigation(page)).toBeVisible()
    await expectNoAxeViolationsInBothThemes(page)
  })

  test('reads the fresh profile after sign-in: no request to /pending for an active user (M2 minor)', async ({
    page,
  }) => {
    // completeSignIn reads the profile through the session client, not the request-cached DAL —
    // a masked failure there would resolve to /pending, which then forwards an active user on.
    const requested: string[] = []
    page.on('request', (request) => requested.push(new URL(request.url()).pathname))
    await signIn(page, await user({ status: 'active', onboarded: true }), '/today')
    await expectPath(page, '/today')
    expect(requested).not.toContain('/pending')
  })

  test('a hidden next=//evil.test injected into the test-login form lands on the home path (M2 minor)', async ({
    page,
  }) => {
    const learner = await user({ status: 'active', onboarded: true })
    await page.goto('/sign-in')
    const form = testLoginForm(page)
    await form.getByLabel('Email').fill(learner.email)
    await form.getByLabel('Mật khẩu').fill(learner.password)
    // The page renders no `next` field at all here (none was given) — a crafted client could
    // still add one; the server action must refuse it too, not only the page that omits it.
    await form.evaluate((formEl: HTMLFormElement) => {
      const next = document.createElement('input')
      next.type = 'hidden'
      next.name = 'next'
      next.value = '//evil.test'
      formEl.append(next)
    })
    await form.getByRole('button', { name: 'Đăng nhập' }).click()
    await expectPath(page, '/today')
  })

  test('the route groups send a user who may not be there to their home', async ({ page }) => {
    // Pending: (app) and (onboarding) need an active account → /pending.
    await signIn(page, await user({ status: 'pending' }))
    for (const path of ['/today', '/onboarding']) {
      await page.goto(path)
      await expectPath(page, '/pending')
    }
    // Active, not onboarded: (app) needs onboarding → /onboarding; /pending has nothing to wait for.
    await page.context().clearCookies()
    await signIn(page, await user({ status: 'active' }))
    for (const path of ['/today', '/pending']) {
      await page.goto(path)
      await expectPath(page, '/onboarding')
    }
  })
})

test.describe('already signed in', () => {
  test('visiting /sign-in goes to your home path', async ({ page }) => {
    await signIn(page, await user({ onboarded: true }))
    await expectPath(page, '/today')
    await page.goto('/sign-in')
    await expectPath(page, '/today')
    await page.goto('/sign-in?next=%2F%2Fevil.test')
    await expectPath(page, '/today')
    await expect(appNavigation(page)).toBeVisible()
  })

  test('a next of //evil.test is ignored', async ({ page, baseURL }) => {
    await signIn(page, await user({ status: 'active' }), '//evil.test')
    await expect(page).toHaveURL(`${baseURL}/onboarding`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chào mừng bạn đến Học Đều')
  })

  test('an onboarded user visiting /onboarding goes to /today', async ({ page }) => {
    await signIn(page, await user({ onboarded: true }))
    await page.goto('/onboarding')
    await expectPath(page, '/today')
  })
})

// ADMIN_EMAILS lists one address per scenario (playwright.config.ts). Fixed addresses cannot be
// created by the desktop and mobile projects at once, so these run on desktop only, and each
// first removes a user an interrupted earlier run may have left behind.
// Bootstrap promotes only while no active admin exists (ruling R13), and an active admin always
// exists here: the seed has one, and parallel specs create their own. Removing them all would race
// those specs, so the promotion itself is checked in pgTAP (041-system-and-admin) and the order
// "bootstrap, then read the profile" in lib/auth/sign-in.test.ts; these scenarios check refusals.
test.describe('admin bootstrap (§2.5, decision 23)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'fixed e-mail addresses: desktop only')
  })

  test('a listed, never-processed pending user stays pending while an active admin exists', async ({
    page,
  }) => {
    // This test's own admin, so an active admin exists whatever else the database holds.
    await user({ status: 'active', role: 'admin' })
    const email = 'bootstrap-admin@example.test'
    await deleteUserByEmail(email)
    const listed = await user({ email, status: 'pending' })
    await signIn(page, listed)
    await expectPath(page, '/pending')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Tài khoản của bạn đang chờ duyệt' }),
    ).toBeVisible()
    expect(await getProfile(listed.id)).toMatchObject({
      role: 'learner',
      status: 'pending',
      approved_at: null,
    })
    await expectNoAxeViolationsInBothThemes(page)
  })

  test('a listed but rejected user stays rejected', async ({ page }) => {
    const email = 'bootstrap-rejected@example.test'
    await deleteUserByEmail(email)
    const rejected = await user({ email, status: 'rejected' })
    await signIn(page, rejected)
    await expectPath(page, '/pending')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Tài khoản chưa được duyệt' }),
    ).toBeVisible()
    expect(await getProfile(rejected.id)).toMatchObject({ role: 'learner', status: 'rejected' })
    await expectNoAxeViolationsInBothThemes(page)
  })

  test('a listed but demoted user stays a learner', async ({ page }) => {
    const email = 'bootstrap-demoted@example.test'
    await deleteUserByEmail(email)
    const demoted = await user({ email, status: 'active', onboarded: true })
    await signIn(page, demoted)
    await expectPath(page, '/today')
    expect(await getProfile(demoted.id)).toMatchObject({ role: 'learner', status: 'active' })
  })
})
