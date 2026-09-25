import type { Page } from '@playwright/test'
import { expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn } from './support/auth'
import { expect, test } from './support/test'
import {
  countEvents,
  createTestUser,
  deleteTestUser,
  getProfile,
  getScheduleVersions,
  getUserTracks,
  latestEventPayload,
  seedLearnerSetup,
  seedPausedTrack,
  type TestUser,
} from './support/users'

/** /settings (task 2.11, §2.4, §5.9, decisions 5, 7, 9, 18). */

const created: string[] = []
test.afterEach(async () => {
  await Promise.all(created.splice(0).map((id) => deleteTestUser(id)))
})

const DSA = 'Cấu trúc dữ liệu & Giải thuật'
const ENGLISH = 'Tiếng Anh cho môi trường IT'
const DAY_MS = 86_400_000
const MINUTE_MS = 60_000

const expectPath = (page: Page, path: string) =>
  expect(page).toHaveURL((url) => url.pathname === path)
/** A track's block under "Lộ trình của bạn", named by its title. */
const track = (page: Page, title: string) => page.getByRole('region', { name: title, exact: true })

/** The next 04:00 in Asia/Ho_Chi_Minh (UTC+7, no DST) strictly after `at`: a 21:00 UTC instant. */
function nextVietnamDayStart(at: number): string {
  const next = new Date(at)
  next.setUTCHours(21, 0, 0, 0)
  if (next.getTime() <= at) next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString()
}

/**
 * An onboarded user with a VN 04:00 schedule (in force for a month), DSA 8w at 60 min/day and
 * English 10w at 25 min/day, signed in on /settings.
 */
async function openSettings(page: Page, role: 'learner' | 'admin' = 'learner'): Promise<TestUser> {
  const user = await createTestUser({ onboarded: true, role })
  created.push(user.id)
  await seedLearnerSetup(user.id, {
    schedule: {
      timezone: 'Asia/Ho_Chi_Minh',
      dayStartsAt: '04:00',
      effectiveAt: new Date(Date.now() - 30 * DAY_MS).toISOString(),
    },
    tracks: [
      { trackId: 'dsa', roadmapVariant: '8w', budgetMinutes: 60, startDate: '2026-09-01' },
      { trackId: 'english', roadmapVariant: '10w', budgetMinutes: 25, startDate: '2026-09-01' },
    ],
  })
  await signIn(page, user, '/settings')
  await expectPath(page, '/settings')
  await expect(page.getByRole('heading', { level: 1, name: 'Cài đặt' })).toBeVisible()
  return user
}

const trackRow = async (userId: string, trackId: string) =>
  (await getUserTracks(userId)).find((row) => row.track_id === trackId)

test('[RF-1] schedule, minutes, pause and resume, and code language', async ({ page }) => {
  const learner = await openSettings(page)
  const main = page.getByRole('main')
  await expect(main.getByRole('link', { name: /^Quản trị/ })).toHaveCount(0)
  await expectNoAxeViolationsInBothThemes(page)

  // The time zone: a new version from the next day start of the schedule in force (§5.9).
  const schedule = page.getByRole('form', { name: 'Lịch học' })
  const zone = schedule.getByLabel('Múi giờ', { exact: true })
  await expect(zone).toHaveValue('Asia/Ho_Chi_Minh')
  await expect(schedule.getByLabel('Ngày mới bắt đầu lúc', { exact: true })).toHaveValue('04:00')
  await zone.selectOption('America/Los_Angeles')
  const before = Date.now()
  await schedule.getByRole('button', { name: 'Lưu lịch học' }).click()
  await expect(
    schedule.getByText(
      /^Thay đổi áp dụng từ .+ lúc 04:00 \(giờ Asia\/Ho_Chi_Minh\) — ngày đang học không bị ảnh hưởng\.$/,
    ),
  ).toBeVisible()
  const after = Date.now()
  await expect(zone).toHaveValue('America/Los_Angeles')
  const versions = await getScheduleVersions(learner.id)
  expect(versions).toHaveLength(2)
  const [inForce, pending] = versions
  expect(inForce?.timezone).toBe('Asia/Ho_Chi_Minh')
  expect(pending?.timezone).toBe('America/Los_Angeles')
  expect(pending?.day_starts_at).toBe('04:00:00')
  // ± 1 minute of the test's clock around the save.
  expect([
    nextVietnamDayStart(before - MINUTE_MS),
    nextVietnamDayStart(after + MINUTE_MS),
  ]).toContain(new Date(pending!.effective_at).toISOString())

  // DSA minutes 60 → 90, then 90 → 45: both saves apply, each with the page's fresh requestId.
  const dsa = track(page, DSA)
  const minutes = dsa.getByLabel('Số phút mỗi ngày', { exact: true })
  const save = dsa.getByRole('button', { name: 'Lưu', exact: true })
  await expect(minutes).toHaveValue('60')
  await minutes.fill('90')
  await save.click()
  await expect.poll(async () => (await trackRow(learner.id, 'dsa'))?.budget_minutes).toBe(90)
  await expect(save).not.toHaveAttribute('aria-busy')
  await minutes.fill('45')
  await save.click()
  await expect.poll(async () => (await trackRow(learner.id, 'dsa'))?.budget_minutes).toBe(45)
  await expect(minutes).toHaveValue('45')
  expect(await countEvents(learner.id, { type: 'track.updated', trackId: 'dsa' })).toBe(2)

  // Pause English, resume it, pause it again: the second pause is a new event.
  const english = track(page, ENGLISH)
  await english.getByRole('button', { name: 'Tạm dừng', exact: true }).click()
  await expect(english.getByRole('button', { name: 'Tiếp tục', exact: true })).toBeVisible()
  await english.getByRole('button', { name: 'Tiếp tục', exact: true }).click()
  await expect(english.getByRole('button', { name: 'Tạm dừng', exact: true })).toBeVisible()
  await english.getByRole('button', { name: 'Tạm dừng', exact: true }).click()
  await expect(english.getByRole('button', { name: 'Tiếp tục', exact: true })).toBeVisible()
  expect((await trackRow(learner.id, 'english'))?.status).toBe('paused')
  expect(await countEvents(learner.id, { type: 'track.paused', trackId: 'english' })).toBe(2)
  expect(await countEvents(learner.id, { type: 'track.resumed', trackId: 'english' })).toBe(1)

  // Code language: none saved reads as Python; Java is saved.
  const language = page.getByRole('form', { name: 'Ngôn ngữ lập trình' })
  await expect(language.getByRole('radio', { name: 'Python' })).toBeChecked()
  await language.getByRole('radio', { name: 'Java' }).click()
  await language.getByRole('button', { name: 'Lưu', exact: true }).click()
  await expect.poll(async () => (await getProfile(learner.id)).code_language).toBe('java')

  // The pending notice, the paused badge and the changed forms, in both themes.
  await expectNoAxeViolationsInBothThemes(page)
})

test('resume records the real pausedDays after a multi-day pause (§5.9, task 4.11)', async ({
  page,
}) => {
  const learner = await openSettings(page)
  await seedPausedTrack(learner.id, 'english', 5)
  await page.reload()
  const english = track(page, ENGLISH)
  await expect(english.getByRole('button', { name: 'Tiếp tục', exact: true })).toBeVisible()
  await english.getByRole('button', { name: 'Tiếp tục', exact: true }).click()
  await expect(english.getByRole('button', { name: 'Tạm dừng', exact: true })).toBeVisible()
  await expect
    .poll(() => latestEventPayload(learner.id, 'track.resumed', 'english'))
    .toEqual({ pausedDays: 5 })
  expect((await trackRow(learner.id, 'english'))?.status).toBe('active')
})

test('resume records pausedDays: 0 for a track paused today (§5.9, task 4.11)', async ({
  page,
}) => {
  const learner = await openSettings(page)
  await seedPausedTrack(learner.id, 'english', 0)
  await page.reload()
  const english = track(page, ENGLISH)
  await expect(english.getByRole('button', { name: 'Tiếp tục', exact: true })).toBeVisible()
  await english.getByRole('button', { name: 'Tiếp tục', exact: true }).click()
  await expect(english.getByRole('button', { name: 'Tạm dừng', exact: true })).toBeVisible()
  await expect
    .poll(() => latestEventPayload(learner.id, 'track.resumed', 'english'))
    .toEqual({ pausedDays: 0 })
  expect((await trackRow(learner.id, 'english'))?.status).toBe('active')
})

test('removing a track moves it to "Thêm lộ trình"; adding it back re-enrolls it', async ({
  page,
}) => {
  const learner = await openSettings(page)
  const add = page.getByRole('form', { name: 'Thêm lộ trình' })
  await expect(add).toHaveCount(0)

  await track(page, ENGLISH).getByRole('button', { name: 'Gỡ lộ trình' }).click()
  const dialog = page.getByRole('alertdialog', { name: `Gỡ lộ trình ${ENGLISH}?` })
  await dialog.getByRole('button', { name: 'Gỡ lộ trình' }).click()
  // While the dialog is open the page behind it is aria-hidden: wait for it to close first.
  await expect(dialog).toHaveCount(0)
  await expect(track(page, ENGLISH)).toHaveCount(0)
  expect((await trackRow(learner.id, 'english'))?.status).toBe('removed')
  // The removed track's buttons are gone: keyboard focus goes to the track list (WCAG 2.4.3).
  await expect(page.locator('[data-slot="track-settings"]')).toBeFocused()

  await expect(add.getByRole('radio', { name: new RegExp(`^${ENGLISH}`) })).toBeChecked()
  await expect(add.getByLabel('Số phút mỗi ngày', { exact: true })).toHaveValue('25')
  await expectNoAxeViolationsInBothThemes(page)
  await add.getByRole('button', { name: 'Thêm lộ trình' }).click()
  await expect(track(page, ENGLISH)).toBeVisible()
  const row = await trackRow(learner.id, 'english')
  expect(row).toMatchObject({ status: 'active', budget_minutes: 25, roadmap_variant: '10w' })
  expect(row?.start_date).not.toBe('2026-09-01')
})

test('an admin sees the "Quản trị" row at the top of Cài đặt, leading to /admin', async ({
  page,
}) => {
  await openSettings(page, 'admin')
  const adminRow = page.getByRole('main').getByRole('link', { name: /^Quản trị/ })
  await expect(adminRow).toBeVisible()
  await adminRow.click()
  await expectPath(page, '/admin/users')
  // Wait for the queue itself, so the test never closes the page mid-render.
  await expect(page.getByRole('heading', { level: 1, name: 'Người dùng' })).toBeVisible()
})
