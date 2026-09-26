import type { Locator, Page } from '@playwright/test'
import { seedDailyActivity } from './support/activity'
import { expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn } from './support/auth'
import { activityOf, checkInEventsOf, checkInOf } from './support/check-in'
import {
  addDays,
  newBlock,
  plansOf,
  seedBlockState,
  seedPlan,
  snapshot,
  stableSchedule,
  type SeedBlock,
} from './support/plans'
import { expect, test } from './support/test'
import { createTestUser, deleteTestUser, seedLearnerSetup, type TestUser } from './support/users'

/**
 * The check-in UI (task 5.2b; §2.4 `/today?block=`, §5.5; DESIGN_SYSTEM §9, §10; RF-2; decision
 * 32 of M4; M-6 a). Every test creates its own learner with a UTC schedule whose day start is far
 * from now (`stableSchedule`) and seeds the plan it checks in, so block IDs are known; cleanup
 * deletes the user — never a plan (decision 35 of M4).
 */

const created: string[] = []
test.afterEach(async () => {
  await Promise.all(created.splice(0).map((id) => deleteTestUser(id)))
})

const DSA = 'Cấu trúc dữ liệu & Giải thuật'
const ENGLISH = 'Tiếng Anh cho môi trường IT'
const PAUSED = 'Lộ trình đang tạm dừng — hoàn thành ít nhất một phần để tiếp tục.'
const RESUMED = 'Bạn đã tiếp tục lộ trình hôm nay — kế hoạch mới có vào ngày mai.'
const SKIPPED_HINT = 'Đã bỏ qua — bấm Sửa khi bạn làm xong'
const SKIPPED_RULE = 'Sửa sau giờ bắt đầu ngày sẽ tính cho hôm nay; ngày trước vẫn chưa hoàn thành.'
/** An overlay hides the page with aria-hidden (focus trapped): axe's aria-hidden-focus is off. */
const OVERLAY = { disableRules: ['aria-hidden-focus'] }

type Track = 'dsa' | 'english'

async function learner(tracks: readonly Track[]): Promise<{ user: TestUser; today: string }> {
  const schedule = stableSchedule()
  const user = await createTestUser({ onboarded: true })
  created.push(user.id)
  await seedLearnerSetup(user.id, {
    schedule,
    tracks: tracks.map((trackId) => ({
      trackId,
      roadmapVariant: trackId === 'dsa' ? '8w' : '10w',
      budgetMinutes: trackId === 'dsa' ? 60 : 25,
      startDate: addDays(schedule.today, -30),
    })),
  })
  return { user, today: schedule.today }
}

/** A plan of `planDate` holding `blocks`; seen two hours ago unless `seen` is false. */
async function plan(
  user: TestUser,
  planDate: string,
  blocks: SeedBlock[],
  seen = true,
): Promise<string> {
  const tracks = Object.fromEntries(
    [...new Set(blocks.map((block) => block.trackId))].map((trackId) => [
      trackId,
      snapshot(trackId === 'dsa' ? '8w' : '10w'),
    ]),
  )
  return seedPlan(user.id, {
    planDate,
    blocks,
    tracks,
    seenAt: seen ? new Date(Date.now() - 2 * 3_600_000).toISOString() : null,
  })
}

const dsaBlock = (day: string) => newBlock(day, 'dsa', [{ itemId: 'dsa:lc-0217', minutes: 20 }])
const englishBlock = (day: string) =>
  newBlock(day, 'english', [{ itemId: 'english:w01-blocker', minutes: 2 }])

async function openToday(page: Page, user: TestUser): Promise<void> {
  await signIn(page, user, '/today')
  await expect(page).toHaveURL((url) => url.pathname === '/today')
  await expect(page.getByRole('heading', { level: 1, name: 'Hôm nay' })).toBeVisible()
}

/** Signs in straight to `/today?block=<id>` (the page behind the open sheet is aria-hidden). */
async function openDeepLink(page: Page, user: TestUser, blockId: string): Promise<void> {
  await signIn(page, user, `/today?${new URLSearchParams({ block: blockId }).toString()}`)
  await expect(page).toHaveURL(
    (url) => url.pathname === '/today' && url.searchParams.get('block') === blockId,
  )
}

const card = (page: Page, trackTitle: string): Locator =>
  page.getByRole('article', { name: `Bài mới ${trackTitle}` })
const oneTap = (scope: Locator | Page, trackTitle: string): Locator =>
  scope.getByRole('button', { name: `Check-in: Bài mới · ${trackTitle}` })
const editLink = (scope: Locator | Page, trackTitle: string): Locator =>
  scope.getByRole('link', { name: `Sửa Bài mới · ${trackTitle}` })
const sheet = (page: Page): Locator => page.getByRole('dialog', { name: 'Check-in: Bài mới' })
const statusRow = (scope: Locator): Locator => scope.locator('[data-slot="check-in-status"]')
const statusPill = (scope: Locator, status: 'done' | 'partial' | 'skipped'): Locator =>
  statusRow(scope).locator(`[data-status="block-${status}"]`)

test('one-tap: the status row "Xong" and one block.checked_in event with the block’s minutes', async ({
  page,
}) => {
  const { user, today } = await learner(['dsa'])
  const block = dsaBlock(today)
  const planId = await plan(user, today, [block])
  await openToday(page, user)
  const dsa = card(page, DSA)
  await oneTap(dsa, DSA).click()
  await expect(statusPill(dsa, 'done')).toHaveText('Xong')
  await expect(dsa.getByText('Đã check-in')).toBeVisible()
  // The block's estimate in the card header reads "20 phút" too: the status row's own minutes.
  await expect(statusRow(dsa).getByText('20 phút', { exact: true })).toBeVisible()
  await expect(oneTap(dsa, DSA)).toHaveCount(0)
  // The button unmounted: focus moves to the block's new "Sửa" link (DESIGN_SYSTEM §10).
  await expect(editLink(dsa, DSA)).toBeFocused()
  const events = await checkInEventsOf(user.id, planId, block.id)
  expect(events.map((event) => event.payload)).toEqual([{ status: 'done', minutes: 20 }])
  expect(await checkInOf(user.id, planId, block.id)).toMatchObject({
    status: 'done',
    minutes: 20,
    auto: false,
    checked_in_on: today,
  })
  await expectNoAxeViolationsInBothThemes(page)
})

test('[RF-2] a double click on one-tap records one event', async ({ page }) => {
  const { user, today } = await learner(['dsa', 'english'])
  const english = englishBlock(today)
  const planId = await plan(user, today, [dsaBlock(today), english])
  await openToday(page, user)
  const englishCard = card(page, ENGLISH)
  await oneTap(englishCard, ENGLISH).dblclick()
  await expect(statusPill(englishCard, 'done')).toBeVisible()
  // The other block is untouched and still offers its one-tap.
  await expect(oneTap(card(page, DSA), DSA)).toBeVisible()
  expect(await checkInEventsOf(user.id, planId, english.id)).toHaveLength(1)
})

test('"Sửa": Một phần, 10 minutes and a note typed in NFD — stored in NFC', async ({ page }) => {
  const { user, today } = await learner(['dsa'])
  const block = dsaBlock(today)
  const planId = await plan(user, today, [block])
  await seedBlockState(user.id, planId, {
    blockId: block.id,
    trackId: 'dsa',
    status: 'done',
    minutes: 20,
    checkedInOn: today,
  })
  await openToday(page, user)
  await editLink(card(page, DSA), DSA).click()
  const dialog = sheet(page)
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL((url) => url.searchParams.get('block') === block.id)
  await expect(dialog.getByRole('heading', { name: 'Check-in: Bài mới' })).toBeFocused()
  await expect(dialog.getByRole('radio', { name: 'Xong' })).toHaveAttribute('aria-checked', 'true')
  await expect(dialog.getByRole('spinbutton', { name: 'Số phút đã học' })).toHaveValue('20')
  await expectNoAxeViolationsInBothThemes(page, OVERLAY)

  const nfc = 'Còn thiếu bài hai — ôn lại Hash Set.'
  const nfd = nfc.normalize('NFD')
  expect(nfd).not.toBe(nfc)
  await dialog.getByRole('radio', { name: 'Một phần' }).click()
  await dialog.getByRole('spinbutton', { name: 'Số phút đã học' }).fill('10')
  await dialog.getByRole('textbox', { name: 'Ghi chú (không bắt buộc)' }).focus()
  await page.keyboard.insertText(nfd)
  await expect(
    dialog.getByText(`${[...new Intl.Segmenter('vi').segment(nfc)].length}/280`),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Lưu check-in' }).click()

  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL((url) => url.pathname === '/today' && !url.searchParams.has('block'))
  const dsa = card(page, DSA)
  await expect(editLink(dsa, DSA)).toBeFocused()
  await expect(statusPill(dsa, 'partial')).toHaveText('Một phần')
  await expect(statusRow(dsa).getByText('10 phút', { exact: true })).toBeVisible()
  expect(await checkInOf(user.id, planId, block.id)).toMatchObject({
    status: 'partial',
    minutes: 10,
    note: nfc,
  })
  const events = await checkInEventsOf(user.id, planId, block.id)
  expect(events.at(-1)?.payload).toEqual({ status: 'partial', minutes: 10, note: nfc })
})

test('/today?block= opens the sheet; back closes it; Esc replaces the URL; an unknown id opens nothing', async ({
  page,
}) => {
  const { user, today } = await learner(['dsa'])
  const block = dsaBlock(today)
  const planId = await plan(user, today, [block])
  await seedBlockState(user.id, planId, {
    blockId: block.id,
    trackId: 'dsa',
    status: 'done',
    minutes: 20,
    checkedInOn: today,
  })
  // The deep link opens the sheet, focused on its title.
  await openDeepLink(page, user, block.id)
  await expect(sheet(page)).toBeVisible()
  await expect(sheet(page).getByRole('heading', { name: 'Check-in: Bài mới' })).toBeFocused()

  // Esc goes back to /today with router.replace: the back button does not reopen the sheet.
  await page.keyboard.press('Escape')
  await expect(sheet(page)).toBeHidden()
  await expect(page).toHaveURL((url) => url.pathname === '/today' && !url.searchParams.has('block'))
  // Nothing opened it on this page: focus goes to the block's "Sửa" (DESIGN_SYSTEM §10).
  await expect(editLink(card(page, DSA), DSA)).toBeFocused()

  // "Sửa" pushes ?block=; the back button closes the sheet.
  await editLink(card(page, DSA), DSA).click()
  await expect(sheet(page)).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL((url) => url.pathname === '/today' && !url.searchParams.has('block'))
  await expect(sheet(page)).toBeHidden()
  await expect(editLink(card(page, DSA), DSA)).toBeFocused()

  // The close button, like Esc.
  await editLink(card(page, DSA), DSA).click()
  await expect(sheet(page)).toBeVisible()
  await sheet(page).getByRole('button', { name: 'Đóng' }).click()
  await expect(sheet(page)).toBeHidden()
  await expect(page).toHaveURL((url) => !url.searchParams.has('block'))
  await expect(editLink(card(page, DSA), DSA)).toBeFocused()

  await page.goto('/today?block=2026-01-01%3Adsa%3Anew%3A9')
  await expect(page.getByRole('heading', { level: 1, name: 'Hôm nay' })).toBeVisible()
  await expect(card(page, DSA)).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  // Nothing was written by opening and closing.
  expect(await checkInEventsOf(user.id, planId, block.id)).toEqual([])
})

test.describe('a save that fails', () => {
  // The aborted server-action request below is logged by the browser.
  test.use({ allowedConsoleErrors: [/Failed to load resource/] })

  test('the sheet’s error state: the message and "Thử lại", which sends again', async ({
    page,
  }) => {
    const { user, today } = await learner(['dsa'])
    const block = dsaBlock(today)
    const planId = await plan(user, today, [block])
    await openDeepLink(page, user, block.id)
    const dialog = sheet(page)
    await expect(dialog).toBeVisible()
    await page.route('**/today**', (route) =>
      route.request().method() === 'POST' ? route.abort() : route.continue(),
    )
    await dialog.getByRole('button', { name: 'Lưu check-in' }).click()
    const failed = dialog.getByRole('status').filter({ hasText: 'Không lưu được thay đổi.' })
    await expect(failed).toBeVisible()
    await expectNoAxeViolationsInBothThemes(page, OVERLAY)
    expect(await checkInEventsOf(user.id, planId, block.id)).toEqual([])

    await page.unroute('**/today**')
    await failed.getByRole('button', { name: 'Thử lại' }).click()
    await expect(dialog).toBeHidden()
    await expect(statusPill(card(page, DSA), 'done')).toBeVisible()
    expect(await checkInEventsOf(user.id, planId, block.id)).toHaveLength(1)
  })
})

test('paused: one-tap on an unfinished block reopens the gate — resumed, no plan for today (decision 32)', async ({
  page,
}) => {
  const { user, today } = await learner(['dsa'])
  const yesterday = addDays(today, -1)
  const block = dsaBlock(yesterday)
  const planId = await plan(user, yesterday, [block])
  await openToday(page, user)
  await expect(page.getByText(PAUSED)).toBeVisible()
  await oneTap(page, DSA).click()
  await expect(page.getByText(RESUMED)).toBeVisible()
  await expect(page.getByText(PAUSED)).toHaveCount(0)
  await expect(statusPill(card(page, DSA), 'done')).toBeVisible()
  expect((await plansOf(user.id)).map((row) => row.plan_date)).toEqual([yesterday])
  expect(await checkInOf(user.id, planId, block.id)).toMatchObject({
    status: 'done',
    checked_in_on: today,
  })
})

test('M-6 a: yesterday’s only block, skipped — "Sửa" → Xong today resumes; yesterday stays incomplete', async ({
  page,
}) => {
  const { user, today } = await learner(['dsa'])
  const yesterday = addDays(today, -1)
  const block = dsaBlock(yesterday)
  const planId = await plan(user, yesterday, [block])
  await seedBlockState(user.id, planId, {
    blockId: block.id,
    trackId: 'dsa',
    status: 'skipped',
    minutes: 0,
    checkedInOn: yesterday,
  })
  await seedDailyActivity(user.id, [{ localDay: yesterday, minutesByTrack: {}, completed: false }])

  await openToday(page, user)
  await expect(page.getByText(PAUSED)).toBeVisible()
  const dsa = card(page, DSA)
  await expect(statusPill(dsa, 'skipped')).toHaveText('Bỏ qua')
  await expect(dsa.getByText(SKIPPED_HINT)).toBeVisible()
  await expect(dsa.getByText(SKIPPED_RULE)).toBeVisible()
  await expectNoAxeViolationsInBothThemes(page)

  await editLink(dsa, DSA).click()
  const dialog = sheet(page)
  await expect(dialog.getByRole('radio', { name: 'Bỏ qua' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await dialog.getByRole('radio', { name: 'Xong' }).click()
  await expect(dialog.getByRole('spinbutton', { name: 'Số phút đã học' })).toHaveValue('20')
  await dialog.getByRole('button', { name: 'Lưu check-in' }).click()

  await expect(page.getByText(RESUMED)).toBeVisible()
  await expect(statusPill(card(page, DSA), 'done')).toBeVisible()
  expect((await plansOf(user.id)).map((row) => row.plan_date)).toEqual([yesterday])
  expect(await checkInOf(user.id, planId, block.id)).toMatchObject({
    status: 'done',
    minutes: 20,
    checked_in_on: today,
  })
  expect(await activityOf(user.id, yesterday)).toMatchObject({ completed: false })
  expect(await activityOf(user.id, today)).toMatchObject({ completed: true })
})
