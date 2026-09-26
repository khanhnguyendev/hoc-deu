import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { expectNoAxeViolations, expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn } from './support/auth'
import { expect, test } from './support/test'
import { createTestUser, deleteTestUser, getProfile, type TestUser } from './support/users'

/** The approval queue at /admin/users (task 2.8, §2.4, decisions 13 and 17). */

// Users this test created; removed after each test (one set of users per test, decision 14). The
// queue lists every account — also other tests' — so rows are found by a unique name.
const created: string[] = []
async function user(options?: Parameters<typeof createTestUser>[0]): Promise<TestUser> {
  const testUser = await createTestUser(options)
  created.push(testUser.id)
  return testUser
}
test.afterEach(async () => {
  await Promise.all(created.splice(0).map((id) => deleteTestUser(id)))
})

const uniqueName = (label: string) => `${label} ${randomUUID().slice(0, 8)}`

/** Waits until the page is at `path` (redirects may still be in flight after a click). */
const expectPath = (page: Page, path: string) =>
  expect(page).toHaveURL((url) => url.pathname === path)

const PENDING = /^Chờ duyệt \(\d+\)$/
const ACTIVE = 'Đang hoạt động'
const SUSPENDED = 'Tạm khoá'
const REJECTED = 'Bị từ chối'

const section = (page: Page, name: string | RegExp) =>
  page.getByRole('region', { name, exact: true })
/** The row of the user named `name` in a section. */
const row = (page: Page, sectionName: string | RegExp, name: string) =>
  section(page, sectionName).getByRole('listitem').filter({ hasText: name })

/**
 * A fresh active admin on /admin/users. Onboarded: for an admin who is not, the AppShell's
 * "Hôm nay" link prefetches `/today`, whose layout redirects to `/onboarding`, and a test that
 * closes its page during that render leaves "The destination stream closed early" in the server
 * log (task 2.8 report).
 */
async function openQueueAsAdmin(page: Page): Promise<TestUser> {
  const admin = await user({
    role: 'admin',
    status: 'active',
    onboarded: true,
    name: uniqueName('Quản trị'),
  })
  await signIn(page, admin, '/admin/users')
  await expectPath(page, '/admin/users')
  await expect(page.getByRole('heading', { level: 1, name: 'Người dùng' })).toBeVisible()
  return admin
}

/** Clicks `button` in the row, answers its confirm dialog and waits for the dialog to close. */
async function confirmAction(page: Page, target: ReturnType<typeof row>, button: string) {
  await target.getByRole('button', { name: button, exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: button, exact: true }).click()
  await expect(dialog).toBeHidden()
}

const statusOf = (id: string) => async () => (await getProfile(id)).status

/** Keyboard focus followed the row to its new section (WCAG 2.4.3), not dropped to <body>. */
const expectFocusInRow = (page: Page, sectionName: string | RegExp, name: string) =>
  expect(row(page, sectionName, name).locator(':focus')).toHaveCount(1)

test.describe('/admin/users', () => {
  test('an admin approves a pending user: the row moves to "Đang hoạt động" and the account is active', async ({
    page,
  }, testInfo) => {
    const pending = await user({ status: 'pending', name: uniqueName('Chờ duyệt') })
    await openQueueAsAdmin(page)
    if (testInfo.project.name === 'mobile') {
      await expect(page.getByRole('banner').getByText('Người dùng')).toBeVisible()
    }
    await expect(row(page, PENDING, pending.name)).toBeVisible()
    await expectNoAxeViolationsInBothThemes(page)

    // By keyboard, as a screen-reader or keyboard user would.
    await row(page, PENDING, pending.name).getByRole('button', { name: 'Duyệt' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText('Đã duyệt tài khoản.')).toBeVisible()
    await expect(row(page, ACTIVE, pending.name)).toBeVisible()
    await expect(row(page, PENDING, pending.name)).toHaveCount(0)
    await expectFocusInRow(page, ACTIVE, pending.name)
    await expect.poll(statusOf(pending.id)).toBe('active')
    expect((await getProfile(pending.id)).approved_at).not.toBeNull()
  })

  test('rejecting asks first (axe clean with the dialog open); a rejected account can be reactivated', async ({
    page,
  }) => {
    const pending = await user({ status: 'pending', name: uniqueName('Từ chối') })
    await openQueueAsAdmin(page)

    await row(page, PENDING, pending.name).getByRole('button', { name: 'Từ chối' }).click()
    const dialog = page.getByRole('alertdialog', {
      name: `Từ chối tài khoản của ${pending.name}?`,
    })
    await expect(dialog).toBeVisible()
    await expectNoAxeViolationsInBothThemes(page, { disableRules: ['aria-hidden-focus'] })
    expect(await statusOf(pending.id)()).toBe('pending')

    await dialog.getByRole('button', { name: 'Từ chối', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('Đã từ chối tài khoản.')).toBeVisible()
    await expect(row(page, REJECTED, pending.name)).toBeVisible()
    await expect.poll(statusOf(pending.id)).toBe('rejected')

    await row(page, REJECTED, pending.name).getByRole('button', { name: 'Kích hoạt lại' }).click()
    await expect(row(page, ACTIVE, pending.name)).toBeVisible()
    await expect.poll(statusOf(pending.id)).toBe('active')
  })

  test('an admin suspends an active user and reactivates them', async ({ page }) => {
    const learner = await user({ status: 'active', name: uniqueName('Tạm khoá') })
    await openQueueAsAdmin(page)

    await confirmAction(page, row(page, ACTIVE, learner.name), 'Tạm khoá')
    await expect(page.getByText('Đã tạm khoá tài khoản.')).toBeVisible()
    await expect(row(page, SUSPENDED, learner.name)).toBeVisible()
    await expectFocusInRow(page, SUSPENDED, learner.name)
    await expect.poll(statusOf(learner.id)).toBe('suspended')

    await row(page, SUSPENDED, learner.name).getByRole('button', { name: 'Kích hoạt lại' }).click()
    await expect(page.getByText('Đã kích hoạt lại tài khoản.')).toBeVisible()
    await expect(row(page, ACTIVE, learner.name)).toBeVisible()
    await expect.poll(statusOf(learner.id)).toBe('active')
  })

  test('an admin promotes a learner to admin (badge + role) and demotes them again', async ({
    page,
  }) => {
    const learner = await user({ status: 'active', name: uniqueName('Phân quyền') })
    await openQueueAsAdmin(page)
    const target = row(page, ACTIVE, learner.name)
    await expect(target.getByText('Quản trị viên', { exact: true })).toHaveCount(0)

    await confirmAction(page, target, 'Đặt làm quản trị')
    await expect(page.getByText('Đã đặt làm quản trị viên.')).toBeVisible()
    await expect(target.getByText('Quản trị viên', { exact: true })).toBeVisible()
    await expect.poll(async () => (await getProfile(learner.id)).role).toBe('admin')

    await confirmAction(page, target, 'Bỏ quyền quản trị')
    await expect(target.getByText('Quản trị viên', { exact: true })).toHaveCount(0)
    await expect.poll(async () => (await getProfile(learner.id)).role).toBe('learner')
  })

  test('the acting admin’s own row says "Bạn" and has no actions (decision 17)', async ({
    page,
  }) => {
    const admin = await openQueueAsAdmin(page)
    const own = row(page, ACTIVE, admin.name)
    await expect(own.getByText('Bạn', { exact: true })).toBeVisible()
    await expect(own.getByText('Quản trị viên', { exact: true })).toBeVisible()
    await expect(own.getByRole('button')).toHaveCount(0)
  })

  test('/admin redirects to /admin/users (decision 13)', async ({ page }) => {
    await openQueueAsAdmin(page)
    await page.goto('/admin')
    await expectPath(page, '/admin/users')
    await expect(page.getByRole('heading', { level: 1, name: 'Người dùng' })).toBeVisible()
  })
})

test.describe('a not-yet-onboarded admin (M2 minor)', () => {
  test('reaches /onboarding first, and /admin/users needs no onboarding', async ({ page }) => {
    const admin = await user({ role: 'admin', status: 'active', name: uniqueName('Chưa xong') })
    await signIn(page, admin)
    await expectPath(page, '/onboarding')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chào mừng bạn đến Học Đều')

    await page.goto('/admin/users')
    await expectPath(page, '/admin/users')
    await expect(page.getByRole('heading', { level: 1, name: 'Người dùng' })).toBeVisible()
    await expect(row(page, ACTIVE, admin.name)).toBeVisible()
  })
})

test.describe('/admin/users for a learner', () => {
  // The 404 page answers with status 404, which Chromium logs as a failed resource load.
  test.use({ allowedConsoleErrors: [/status of 404/] })

  test('a learner gets the Vietnamese 404, on /admin as well', async ({ page }) => {
    const learner = await user({ status: 'active', onboarded: true })
    await signIn(page, learner)
    await expectPath(page, '/today')

    for (const path of ['/admin/users', '/admin']) {
      const response = await page.goto(path)
      expect(response?.status()).toBe(404)
      await expect(
        page.getByRole('heading', { level: 1, name: 'Không tìm thấy trang' }),
      ).toBeVisible()
      await expect(page.getByRole('heading', { level: 1, name: 'Người dùng' })).toHaveCount(0)
    }
    await expectNoAxeViolations(page)
  })
})
