import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { deleteOpsMetric, seedOpsMetric } from './support/admin'
import { getAiFlag } from './support/bot'
import { expectNoAxeViolations, expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn } from './support/auth'
import { seedPlan, snapshot } from './support/plans'
import { expect, test } from './support/test'
import {
  createTestUser,
  deleteTestUser,
  getProfile,
  seedLearnerSetup,
  setStatus,
  type TestUser,
} from './support/users'

/**
 * The approval queue at /admin/users (task 2.8, §2.4, decisions 13 and 17), and the admin overview
 * at /admin and /admin/content (task 5.6).
 */

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
    // Only the AI flag (decision 34: the owner is the first AI learner).
    await expect(own.getByRole('switch')).toHaveCount(1)
  })

  test('an admin turns the AI flag on and off for a learner, and on their own row (task 6.3)', async ({
    page,
  }) => {
    const learner = await user({ status: 'active', name: uniqueName('Cá nhân hoá') })
    const pending = await user({ status: 'pending', name: uniqueName('Chưa duyệt AI') })
    const admin = await openQueueAsAdmin(page)
    const flag = (name: string) =>
      row(page, ACTIVE, name).getByRole('switch', { name: 'Cá nhân hoá AI', exact: true })

    await expect(flag(learner.name)).toHaveAttribute('aria-checked', 'false')
    // Active accounts only: none in the queue.
    await expect(row(page, PENDING, pending.name).getByRole('switch')).toHaveCount(0)
    await expectNoAxeViolationsInBothThemes(page)

    await flag(learner.name).click()
    await expect(page.getByText('Đã bật cá nhân hoá AI.').first()).toBeVisible()
    await expect.poll(() => getAiFlag(learner.id)).toBe(true)
    await page.reload()
    await expect(flag(learner.name)).toHaveAttribute('aria-checked', 'true')

    await flag(learner.name).click()
    await expect(page.getByText('Đã tắt cá nhân hoá AI.').first()).toBeVisible()
    await expect.poll(() => getAiFlag(learner.id)).toBe(false)

    await flag(admin.name).click()
    await expect.poll(() => getAiFlag(admin.id)).toBe(true)
    await page.reload()
    await expect(flag(admin.name)).toHaveAttribute('aria-checked', 'true')
  })

  test('a stale "Duyệt" does not re-activate an account another admin rejected (p_expected_from)', async ({
    page,
  }) => {
    const pending = await user({ status: 'pending', name: uniqueName('Đã bị từ chối') })
    await openQueueAsAdmin(page)
    await expect(row(page, PENDING, pending.name)).toBeVisible()

    // Another admin rejects the account while this list still shows it pending.
    await setStatus(pending.id, 'rejected')
    await row(page, PENDING, pending.name).getByRole('button', { name: 'Duyệt' }).click()
    await expect(
      page.getByText('Tài khoản đã đổi trạng thái. Bạn tải lại trang nhé.').first(),
    ).toBeVisible()
    // The list re-renders with the account's current state; nothing changed.
    await expect(row(page, REJECTED, pending.name)).toBeVisible()
    await expect(row(page, PENDING, pending.name)).toHaveCount(0)
    expect(await statusOf(pending.id)()).toBe('rejected')
  })
})

/** `YYYY-MM-DD` of the database's date (UTC): `admin_track_positions` looks 14 days back from it. */
const utcToday = () => new Date().toISOString().slice(0, 10)

/** An active learner in DSA 10w whose plan of today is in roadmap week `week` (decision 25). */
async function learnerInDsaWeek(week: number): Promise<TestUser> {
  const learner = await user({ status: 'active', onboarded: true })
  await seedLearnerSetup(learner.id, {
    tracks: [{ trackId: 'dsa', roadmapVariant: '10w', budgetMinutes: 60, startDate: utcToday() }],
  })
  await seedPlan(learner.id, {
    planDate: utcToday(),
    blocks: [],
    tracks: { dsa: { ...snapshot('10w'), week } },
  })
  return learner
}

async function openAsAdmin(page: Page, path: string): Promise<TestUser> {
  const admin = await user({
    role: 'admin',
    status: 'active',
    onboarded: true,
    name: uniqueName('Quản trị'),
  })
  await signIn(page, admin, path)
  await expectPath(page, path)
  return admin
}

test.describe('/admin (task 5.6)', () => {
  test('an admin sees the overview: warnings, counts, system status and the admin links', async ({
    page,
  }) => {
    await user({ status: 'pending', name: uniqueName('Chờ') })
    await openAsAdmin(page, '/admin')
    await expect(page.getByRole('heading', { level: 1, name: 'Quản trị' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Cảnh báo', exact: true })).toBeVisible()
    const counts = page.getByRole('region', { name: 'Tài khoản và hoạt động' })
    await expect(counts.getByText('Chờ duyệt', { exact: true })).toBeVisible()
    await expect(counts.getByText('Kế hoạch được tạo', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Hệ thống' }).getByText('Dung lượng cơ sở dữ liệu'),
    ).toBeVisible()

    const links = page.getByRole('region', { name: 'Trang quản trị' })
    await expect(links.getByRole('link', { name: /Người dùng/ })).toContainText(
      /\d+ tài khoản chờ duyệt/,
    )
    await expectNoAxeViolationsInBothThemes(page)

    await links.getByRole('link', { name: /Người dùng/ }).click()
    await expectPath(page, '/admin/users')
    await expect(page.getByRole('heading', { level: 1, name: 'Người dùng' })).toBeVisible()
  })

  test('/admin/content shows the coverage table with red rows for a learner at DSA week 3', async ({
    page,
  }) => {
    // W4–W5 of DSA 10w have no pattern lesson and no notes yet: within week 3 + 2, so red.
    await learnerInDsaWeek(3)
    await openAsAdmin(page, '/admin/content')
    await expect(page.getByRole('heading', { level: 1, name: 'Nội dung' })).toBeVisible()
    const table = page.getByRole('region', {
      name: 'Độ phủ theo tuần của Cấu trúc dữ liệu & Giải thuật, 10 tuần',
    })
    const week = (n: number) =>
      table
        .getByRole('row')
        .filter({ has: page.getByRole('rowheader', { name: String(n), exact: true }) })
    for (const n of [4, 5]) {
      await expect(week(n)).toHaveAttribute('data-state', 'red')
      await expect(week(n)).toContainText('Cần bổ sung')
    }
    await expect(week(1)).toHaveAttribute('data-state', 'covered')
    await expect(page.getByRole('region', { name: 'Bản nháp', exact: true })).toBeVisible()
    await expectNoAxeViolationsInBothThemes(page)

    // /admin shows the same red warning, with its one action back to /admin/content.
    await page.goto('/admin')
    const warning = page
      .getByRole('region', { name: 'Cảnh báo', exact: true })
      .getByRole('listitem')
      .filter({ hasText: 'Cấu trúc dữ liệu & Giải thuật (10 tuần)' })
    await expect(warning).toContainText('tuần 4, 5')
    await expect(warning.locator('[data-slot="banner"]')).toHaveAttribute('data-tone', 'danger')
    await expect(warning.getByRole('link', { name: 'Xem độ phủ nội dung' })).toHaveAttribute(
      'href',
      '/admin/content',
    )
  })
})

test.describe('/admin DB-size warning (global ops_metrics row)', () => {
  // The seeded row is global state: this block runs serially and deletes its row in `finally`.
  test.describe.configure({ mode: 'serial' })

  test('a 360 MB database shows the 350 MB warning (ADR-0031) and the size', async ({ page }) => {
    const id = await seedOpsMetric('db.size_bytes', 360 * 1024 * 1024)
    try {
      await openAsAdmin(page, '/admin')
      const warning = page
        .getByRole('region', { name: 'Cảnh báo', exact: true })
        .getByRole('listitem')
        .filter({ hasText: 'Cơ sở dữ liệu đã dùng 360 MB' })
      await expect(warning).toContainText('đến lúc bật nén sự kiện cũ (ADR-0031)')
      await expect(warning.locator('[data-slot="banner"]')).toHaveAttribute('data-tone', 'warning')
      await expect(
        warning.getByRole('link', { name: 'Xem ADR-0031 (mở trong tab mới)' }),
      ).toHaveAttribute('target', '_blank')
      await expect(page.getByRole('region', { name: 'Hệ thống' })).toContainText('360 MB')
      await expectNoAxeViolationsInBothThemes(page)
    } finally {
      await deleteOpsMetric(id)
    }
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

  test('a learner gets the Vietnamese 404, on /admin, /admin/content and /admin/bot as well', async ({
    page,
  }) => {
    const learner = await user({ status: 'active', onboarded: true })
    await signIn(page, learner)
    await expectPath(page, '/today')

    for (const path of ['/admin/users', '/admin', '/admin/content', '/admin/bot']) {
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
