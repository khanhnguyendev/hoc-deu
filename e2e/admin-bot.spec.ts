import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { expectNoAxeViolations, expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn } from './support/auth'
import { readBotSettingsRow, updateBotSettingsRow } from './support/bot'
import { expect, test } from './support/test'
import { createTestUser, deleteTestUser, type TestUser } from './support/users'

/**
 * `/admin/bot` (task 6.3, §2.4, §6.2, §6.3). `bot_settings` is one global row, so this file runs
 * serially and changes only `content_proposals` and the per-run cap, restoring both in `finally`;
 * it never touches `enabled`, `dry_run` or the token (6.8's, decision 23) — the rotation dialog is
 * opened and cancelled, never confirmed (the shown-once field is render-tested). The HTTP side of
 * `requireBotToken` (401 / 503 / 429 against real routes) is 6.8's contract suite.
 */
test.describe.configure({ mode: 'serial' })

const created: string[] = []
test.afterEach(async () => {
  await Promise.all(created.splice(0).map((id) => deleteTestUser(id)))
})

async function openBotPageAsAdmin(page: Page): Promise<TestUser> {
  const admin = await createTestUser({
    role: 'admin',
    status: 'active',
    onboarded: true,
    name: `Quản trị ${randomUUID().slice(0, 8)}`,
  })
  created.push(admin.id)
  await signIn(page, admin, '/admin/bot')
  await expect(page).toHaveURL((url) => url.pathname === '/admin/bot')
  await expect(page.getByRole('heading', { level: 1, name: 'Bot AI' })).toBeVisible()
  return admin
}

/**
 * `expectNoAxeViolationsInBothThemes`, but each scan waits until every running animation and
 * transition has finished: switching the theme animates `transition-colors` elements (the dialog's
 * primary button), and axe once measured one halfway between the dark and the light primary
 * (4.37:1, e2e fix round 2) — a state no one sees for longer than `--duration-fast`.
 */
async function expectNoAxeViolationsInBothSettledThemes(
  page: Page,
  options?: { disableRules?: string[] },
): Promise<void> {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
      .toBe(colorScheme === 'dark')
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))),
    )
    await expectNoAxeViolations(page, options)
  }
}

const toggle = (page: Page, name: string) => page.getByRole('switch', { name, exact: true })
const cap = (page: Page) =>
  page.getByRole('spinbutton', { name: 'Số người dùng tối đa mỗi lần chạy' })

test('an admin sees the controls and the token; axe clean in both themes, the dialog too', async ({
  page,
}, testInfo) => {
  await openBotPageAsAdmin(page)
  if (testInfo.project.name === 'mobile') {
    await expect(page.getByRole('banner').getByText('Bot AI')).toBeVisible()
  } else {
    await expect(page.getByRole('link', { name: 'Bot AI' })).toHaveAttribute('aria-current', 'page')
  }
  // BOT_API_ENABLED is on in e2e (playwright.config.ts): no env banner.
  await expect(page.getByText(/^Chưa bật API bot/)).toHaveCount(0)
  for (const name of ['Bật bot', 'Chạy thử (dry-run)', 'Đề xuất nội dung']) {
    await expect(toggle(page, name)).toBeVisible()
  }
  await expect(cap(page)).toHaveAttribute('max', '100')
  const tokenSection = page.getByRole('region', { name: 'Token truy cập' })
  await expect(tokenSection).toContainText(/Chưa có token|Token hiện tại tạo lúc|Đã có token/)
  await expectNoAxeViolationsInBothThemes(page)

  // The rotation asks first (the first token has its own title); cancelled here, so 6.8’s token
  // stays as it is.
  await tokenSection.getByRole('button', { name: 'Tạo token mới' }).click()
  const dialog = page.getByRole('alertdialog', { name: /^Tạo token (mới|đầu tiên)\?$/ })
  await expect(dialog).toBeVisible()
  await expectNoAxeViolationsInBothSettledThemes(page, { disableRules: ['aria-hidden-focus'] })
  await dialog.getByRole('button', { name: 'Huỷ' }).click()
  await expect(dialog).toBeHidden()
  await expect(tokenSection.getByRole('textbox')).toHaveCount(0)
})

test('an admin toggles "Đề xuất nội dung" and saves the per-run cap; both hold after a reload', async ({
  page,
}, testInfo) => {
  // One global row: the desktop project alone changes it, so the two projects never race.
  test.skip(testInfo.project.name !== 'desktop', 'bot_settings is global: desktop only')
  const before = await readBotSettingsRow()
  try {
    await openBotPageAsAdmin(page)
    const proposals = toggle(page, 'Đề xuất nội dung')
    await expect(proposals).toHaveAttribute('aria-checked', String(before.content_proposals))

    await proposals.click()
    await expect(page.getByText('Đã lưu cài đặt bot.').first()).toBeVisible()
    await expect
      .poll(async () => (await readBotSettingsRow()).content_proposals)
      .toBe(!before.content_proposals)

    const nextCap = before.per_run_user_cap === 10 ? 11 : 10
    const save = page.getByRole('button', { name: 'Lưu', exact: true })
    await cap(page).fill(String(nextCap))
    await save.click()
    await expect.poll(async () => (await readBotSettingsRow()).per_run_user_cap).toBe(nextCap)
    // The save and its re-render are over (the button is busy until then).
    await expect(save).not.toHaveAttribute('aria-busy', 'true')

    // Out of range: refused in the form, nothing sent.
    await cap(page).fill('101')
    await save.click()
    await expect(page.getByText('Nhập một số nguyên từ 1 đến 100.')).toBeVisible()
    expect((await readBotSettingsRow()).per_run_user_cap).toBe(nextCap)

    await page.reload()
    await expect(toggle(page, 'Đề xuất nội dung')).toHaveAttribute(
      'aria-checked',
      String(!before.content_proposals),
    )
    await expect(cap(page)).toHaveValue(String(nextCap))
  } finally {
    await updateBotSettingsRow({
      content_proposals: before.content_proposals,
      per_run_user_cap: before.per_run_user_cap,
    })
  }
})
