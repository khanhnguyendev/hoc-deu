import type { Page } from '@playwright/test'
import { expect } from './test'
import type { TestUser } from './users'

/** How long the sign-in redirect may take (see `signIn`). */
const SIGN_IN_TIMEOUT_MS = 15_000

/** The test-login form on /sign-in (AUTH_TEST_LOGIN=true, §2.3). */
export const testLoginForm = (page: Page) =>
  page.getByRole('form', { name: 'Biểu mẫu đăng nhập thử nghiệm' })

/**
 * Signs in through the test-login form on `/sign-in` (with `?next=` when given) and waits until
 * the app has redirected away from the sign-in page — up to 15 s: the redirect renders the target
 * page (often building today's plan), which under a full parallel run can outlast `expect`'s
 * default 5 s (flagged by the M5 fix pass, group A).
 */
export async function signIn(
  page: Page,
  user: Pick<TestUser, 'email' | 'password'>,
  next?: string,
): Promise<void> {
  await page.goto(next === undefined ? '/sign-in' : `/sign-in?next=${encodeURIComponent(next)}`)
  const form = testLoginForm(page)
  await form.getByLabel('Email').fill(user.email)
  await form.getByLabel('Mật khẩu').fill(user.password)
  await form.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).not.toHaveURL(/\/sign-in(?:\?|$)/, { timeout: SIGN_IN_TIMEOUT_MS })
}
