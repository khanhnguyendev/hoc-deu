import { expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn, testLoginForm } from './support/auth'
import { expect, test } from './support/test'
import { createTestUser, deleteTestUser, userExists, type TestUser } from './support/users'

/** Account deletion from /settings (task 2.11b, §4.6). */

const created: string[] = []
test.afterEach(async () => {
  await Promise.all(created.splice(0).map((id) => deleteTestUser(id)))
})

test('deletes the account from /settings: "/" with the notice, gone from the admin API, sign-in fails', async ({
  page,
}) => {
  const user: TestUser = await createTestUser({ onboarded: true })
  created.push(user.id)
  await signIn(page, user, '/settings')
  await expect(page.getByRole('heading', { level: 1, name: 'Cài đặt' })).toBeVisible()

  const section = page.getByRole('region', { name: 'Xoá tài khoản' })
  await expect(
    section.getByText(
      'Dữ liệu đã xoá vẫn có thể tồn tại trong bản sao lưu đã mã hoá tối đa 90 ngày.',
    ),
  ).toBeVisible()
  await section.getByRole('button', { name: 'Xoá vĩnh viễn' }).click()

  const dialog = page.getByRole('alertdialog', { name: 'Xoá tài khoản vĩnh viễn?' })
  await expect(dialog).toBeVisible()
  await expectNoAxeViolationsInBothThemes(page)

  await dialog.getByRole('button', { name: 'Xoá vĩnh viễn' }).click()
  await expect(page).toHaveURL(
    (url) => url.pathname === '/' && url.searchParams.get('account') === 'deleted',
  )
  await expect(page.getByText('Tài khoản của bạn đã được xoá.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Đăng nhập' })).toBeVisible()
  // The redirect is a client-side transition: the document title updates asynchronously.
  await expect(page).toHaveTitle('Học Đều')
  await expectNoAxeViolationsInBothThemes(page)

  await expect.poll(() => userExists(user.id)).toBe(false)

  await page.goto('/sign-in')
  const form = testLoginForm(page)
  await form.getByLabel('Email').fill(user.email)
  await form.getByLabel('Mật khẩu').fill(user.password)
  await form.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(form.getByRole('alert')).toHaveText('Email hoặc mật khẩu không đúng.')
})
