import type { Page } from '@playwright/test'
import { expect } from './test'
import type { TestUser } from './users'

/** The test-login form on /sign-in (AUTH_TEST_LOGIN=true, §2.3). */
export const testLoginForm = (page: Page) =>
  page.getByRole('form', { name: 'Biểu mẫu đăng nhập thử nghiệm' })

/**
 * Signs in through the test-login form on `/sign-in` (with `?next=` when given) and waits until
 * the app has redirected away from the sign-in page.
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
  await expect(page).not.toHaveURL(/\/sign-in(?:\?|$)/)
}
